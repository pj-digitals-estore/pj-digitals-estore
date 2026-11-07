/* global __dirname */
// Read literal sample records without executing app code or reading credentials.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function literal(node) {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Unsupported sample property.');
    return [property.name.getText().replace(/^['"]|['"]$/g, ''), literal(property.initializer)];
  }));
  throw new Error('Only literal preview data is supported.');
}
function readArray(file, name) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) result = literal(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!Array.isArray(result)) throw new Error(`Missing preview array ${name} in ${file}.`);
  return result;
}
const snapshot = {
  generatedAt: new Date().toISOString(),
  source: 'App source samples; not live sessions or database records',
  shops: readArray('client/src/features/storefront/data/catalog.ts', 'stores').filter(shop => !['all', 'catalogue'].includes(shop.id)),
  products: readArray('client_shop/src/context/ShopDataContext.tsx', 'initialProducts'),
  orders: readArray('client_shop/src/context/ShopDataContext.tsx', 'initialOrders'),
  shopDeliveries: readArray('client_shop/src/context/ShopDataContext.tsx', 'initialDeliveries'),
  deliveries: readArray('client_delivery/src/screens/DeliveryScreen.tsx', 'initialJobs'),
};
const target = path.join(__dirname, '../src/data/app-preview.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Updated preview: ${snapshot.shops.length} directory shops, ${snapshot.products.length} products, ${snapshot.orders.length} shop orders, ${snapshot.deliveries.length} delivery jobs.`);
