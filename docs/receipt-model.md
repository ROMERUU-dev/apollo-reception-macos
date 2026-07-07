# Receipt model

`ReceiptDocument` is the portable semantic representation. It supports payment tickets, quotes, cash opening, cash close/cut, and generic vouchers. It is not a CFDI model.

Documents contain facility/header data, optional customer reference, line items, subtotal, typed adjustments, total, payments, optional change/footer, and an optional QR reference. HTML supplied by callers is never accepted.

Money is `{ currency: "MXN" | "USD", amount: "1200.00" }`. Exactly two decimal places are required, and calculations/conversions in the core use `bigint` minor units. JavaScript floating point is not used for money arithmetic.

The 58 mm and 80 mm profiles use 32 and 48 **conceptual preview columns**. They make deterministic Linux previews and wrapping tests possible; they do not claim a physical printer's character count. The native adapter must map width and typography to the selected printer/driver.

Renderers available now:

- plain text preview;
- escaped HTML preview.

ESC/POS and vendor-specific rendering are deliberately absent until hardware/driver selection.
