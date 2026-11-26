import { Request, Response } from "express";
import Location from "../models/Location.js";
import Shop from "../models/Shop.js";
import Address from "../models/Address.js";
import Order from "../models/Order.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Advertisement from "../models/Advertisement.js";
import { HttpError, sendError } from "../utils/http.js";
import { logActivity } from "../utils/activity.js";
import { cleanLocationName, invalidateLocations, locationKey, locationNameProblem } from "../utils/locations.js";

const OPEN_ORDER = { orderStatus: { $nin: ["delivered", "cancelled"] } };

/** Rewrites every record that stores this location's name. Finished orders keep the name they were placed with. */
const renameEverywhere = async (from: string, to: string) => {
  await Promise.all([
    Shop.updateMany({ location: from }, { $set: { location: to } }),
    Address.updateMany({ location: from }, { $set: { location: to } }),
    Order.updateMany({ "shippingAddress.location": from, ...OPEN_ORDER }, { $set: { "shippingAddress.location": to } }),
    DeliveryPartner.updateMany({ serviceLocations: from }, { $set: { "serviceLocations.$[l]": to } }, { arrayFilters: [{ l: from }] }),
    Advertisement.updateMany({ targetLocations: from }, { $set: { "targetLocations.$[l]": to } }, { arrayFilters: [{ l: from }] }),
  ]);
};

// GET /api/admin/locations - every location with how much uses it
export const adminListLocations = async (_req: Request, res: Response) => {
  try {
    const [rows, shops, drivers, addresses] = await Promise.all([
      Location.find().sort({ order: 1, name: 1 }).lean(),
      Shop.aggregate([{ $group: { _id: "$location", n: { $sum: 1 } } }]),
      DeliveryPartner.aggregate([{ $unwind: "$serviceLocations" }, { $group: { _id: "$serviceLocations", n: { $sum: 1 } } }]),
      Address.aggregate([{ $group: { _id: "$location", n: { $sum: 1 } } }]),
    ]);
    const count = (list: any[]) => new Map(list.map((x: any) => [x._id, x.n]));
    const s = count(shops), d = count(drivers), a = count(addresses);
    res.json({ success: true, data: rows.map((l: any) => ({ ...l, shops: s.get(l.name) ?? 0, drivers: d.get(l.name) ?? 0, addresses: a.get(l.name) ?? 0 })) });
  } catch (error) {
    sendError(res, error, "Failed to load locations");
  }
};

// POST /api/admin/locations { name }
export const adminCreateLocation = async (req: Request, res: Response) => {
  try {
    const name = cleanLocationName(req.body.name);
    const bad = locationNameProblem(name);
    if (bad) throw new HttpError(400, bad);
    if (await Location.exists({ nameKey: locationKey(name) })) throw new HttpError(409, `"${name}" already exists`);
    const last: any = await Location.findOne().sort({ order: -1 }).select("order").lean();
    const loc = await Location.create({ name, nameKey: locationKey(name), order: (last?.order ?? -1) + 1, isActive: true });
    invalidateLocations();
    await logActivity(req, "location.created", "Location", loc._id, { name });
    res.status(201).json({ success: true, data: loc });
  } catch (error: any) {
    if (error?.code === 11000) return void res.status(409).json({ success: false, message: "That location already exists" });
    sendError(res, error, "Failed to create location");
  }
};

// PUT /api/admin/locations/:id { name?, isActive? }   (a new name is applied to shops, addresses, drivers, ads and open orders)
export const adminUpdateLocation = async (req: Request, res: Response) => {
  try {
    const loc: any = await Location.findById(req.params.id);
    if (!loc) throw new HttpError(404, "Location not found");
    const oldName: string = loc.name;
    let renamed = false;

    if (req.body.isActive !== undefined) {
      const on = req.body.isActive === true || req.body.isActive === "true";
      if (!on) {
        const others = await Location.countDocuments({ isActive: true, _id: { $ne: loc._id } });
        if (others === 0) throw new HttpError(400, "At least one location must stay active");
      }
      loc.isActive = on;
    }
    if (req.body.deliveryEnabled !== undefined) loc.deliveryEnabled = req.body.deliveryEnabled === true || req.body.deliveryEnabled === "true";
    // delivery rules: a number (rupees) or empty = use the platform setting
    for (const f of ["deliveryFee", "freeAbove", "minOrder"] as const) {
      if (req.body[f] === undefined) continue;
      const v = req.body[f];
      if (v === null || v === "") { loc[f] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100000) throw new HttpError(400, `${f === "deliveryFee" ? "Delivery fee" : f === "freeAbove" ? "Free delivery above" : "Minimum order"} must be a number, 0 or more`);
      loc[f] = Math.round(n * 100) / 100;
    }
    if (req.body.name !== undefined) {
      const name = cleanLocationName(req.body.name);
      if (name !== oldName) {
        const bad = locationNameProblem(name);
        if (bad) throw new HttpError(400, bad);
        if (await Location.exists({ nameKey: locationKey(name), _id: { $ne: loc._id } })) {
          throw new HttpError(409, `"${name}" already exists. Use delete → move everything to merge them.`);
        }
        loc.name = name;
        loc.nameKey = locationKey(name);
        renamed = true;
      }
    }
    await loc.save();
    if (renamed) await renameEverywhere(oldName, loc.name);
    invalidateLocations();
    await logActivity(req, "location.updated", "Location", loc._id, { from: oldName, to: loc.name, isActive: loc.isActive, deliveryEnabled: loc.deliveryEnabled, deliveryFee: loc.deliveryFee, freeAbove: loc.freeAbove, minOrder: loc.minOrder });
    res.json({ success: true, data: loc, renamed });
  } catch (error: any) {
    if (error?.code === 11000) return void res.status(409).json({ success: false, message: "That location already exists" });
    sendError(res, error, "Failed to update location");
  }
};

// PUT /api/admin/locations/order { ids: [...] }
export const adminReorderLocations = async (req: Request, res: Response) => {
  try {
    const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) throw new HttpError(400, "ids is required");
    await Location.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } })));
    invalidateLocations();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed to reorder locations");
  }
};

// DELETE /api/admin/locations/:id?moveTo=<name>
// A location that's in use needs somewhere to send its shops, drivers, addresses and ads (moveTo).
export const adminDeleteLocation = async (req: Request, res: Response) => {
  try {
    const loc: any = await Location.findById(req.params.id);
    if (!loc) throw new HttpError(404, "Location not found");
    if ((await Location.countDocuments()) <= 1) throw new HttpError(400, "The last location can't be deleted");

    const inUse =
      (await Shop.exists({ location: loc.name })) || (await Address.exists({ location: loc.name })) ||
      (await DeliveryPartner.exists({ serviceLocations: loc.name })) || (await Advertisement.exists({ targetLocations: loc.name }));

    let movedTo: string | undefined;
    if (inUse) {
      const targetName = cleanLocationName(req.query.moveTo);
      if (!targetName) throw new HttpError(400, "This location is in use. Choose where to move its shops, drivers and addresses (moveTo).");
      const target: any = await Location.findOne({ nameKey: locationKey(targetName) });
      if (!target) throw new HttpError(400, `"${targetName}" isn't a location`);
      if (String(target._id) === String(loc._id)) throw new HttpError(400, "Choose a different location to move things to");
      movedTo = target.name;
      await Promise.all([
        Shop.updateMany({ location: loc.name }, { $set: { location: target.name } }),
        Address.updateMany({ location: loc.name }, { $set: { location: target.name } }),
        Order.updateMany({ "shippingAddress.location": loc.name, ...OPEN_ORDER }, { $set: { "shippingAddress.location": target.name } }),
      ]);
      // lists: add the target once, then drop the old one
      for (const Model of [DeliveryPartner, Advertisement] as any[]) {
        const field = Model === DeliveryPartner ? "serviceLocations" : "targetLocations";
        await Model.updateMany({ [field]: loc.name }, { $addToSet: { [field]: target.name } });
        await Model.updateMany({ [field]: loc.name }, { $pull: { [field]: loc.name } });
      }
    }
    await loc.deleteOne();
    invalidateLocations();
    await logActivity(req, "location.deleted", "Location", loc._id, { name: loc.name, movedTo });
    res.json({ success: true, movedTo });
  } catch (error) {
    sendError(res, error, "Failed to delete location");
  }
};
