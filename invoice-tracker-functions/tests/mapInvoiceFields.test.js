const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapInvoiceFields,
} = require("../dist/src/mapper/mapInvoiceFields.js");

test("mapInvoiceFields normalizes strings and numbers", () => {
  const result = mapInvoiceFields({
    LinkTitle: " INV-1001 ",
    field_1: " Acme Pty Ltd ",
    field_2: " accounts@acme.test ",
    field_7: "100.50",
    field_8: 10,
    field_28: "30",
    id: " 42 ",
    Created: "2026-03-01",
    Modified: "2026-03-02",
  });

  assert.deepEqual(result, {
    InvoiceNumber: "INV-1001",
    ClientName: "Acme Pty Ltd",
    ClientEmail: "accounts@acme.test",
    ProjectName: undefined,
    InvoiceDate: undefined,
    DueDate: undefined,
    Currency: undefined,
    Subtotal: 100.5,
    TaxRate: 10,
    TaxAmount: undefined,
    TotalAmount: undefined,
    AmountPaid: undefined,
    Balance: undefined,
    Status: undefined,
    PaymentTerms: undefined,
    PaymentMethod: undefined,
    PurchaseOrderNumber: undefined,
    SentDate: undefined,
    PaidDate: undefined,
    LastReminderDate: undefined,
    Owner: undefined,
    Notes: undefined,
    ReminderEnabled: undefined,
    DoNotContact: undefined,
    ReminderPausedUntil: undefined,
    ReminderFrequencyDays: undefined,
    NextReminderDate: undefined,
    EscalationEnabled: undefined,
    EscalationThresholdDays: 30,
    CollectionPriority: undefined,
    Id: "42",
    Created: "2026-03-01",
    Modified: "2026-03-02",
  });
});

test("mapInvoiceFields falls back to Title and ignores invalid values", () => {
  const result = mapInvoiceFields({
    Title: "INV-1002",
    field_1: "   ",
    field_7: "not-a-number",
    field_8: Infinity,
    id: 99,
  });

  assert.equal(result.InvoiceNumber, "INV-1002");
  assert.equal(result.ClientName, undefined);
  assert.equal(result.Subtotal, undefined);
  assert.equal(result.TaxRate, undefined);
  assert.equal(result.Id, undefined);
});
