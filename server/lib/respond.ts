import type { Response } from 'express';
import { HttpError } from './trialValidation.js';
export function failure(res: Response, error: any) {
  const status = error instanceof HttpError ? error.status : error?.name === 'VersionError' || error?.code === 11000 ? 409 : error?.name === 'ValidationError' || error?.name === 'CastError' ? 400 : 500;
  return res.status(status).json({ success: false, message: status === 500 ? 'The request could not be completed. Please check its status before trying again.' : error.message });
}
