export type InvoiceReminderItem = {
  InvoiceNumber?: string;
  ClientName?: string;
  ClientEmail?: string;
  ProjectName?: string;
  InvoiceDate?: string;
  DueDate?: string;
  Currency?: string;
  Subtotal?: number;
  TaxRate?: number;
  TaxAmount?: number;
  TotalAmount?: number;
  AmountPaid?: number;
  Balance?: number;
  Status?: string;
  PaymentTerms?: string;
  PaymentMethod?: string;
  PurchaseOrderNumber?: string;
  SentDate?: string;
  PaidDate?: string;
  LastReminderDate?: string;
  Owner?: string;
  Notes?: string;
  ReminderEnabled?: string;
  DoNotContact?: string;
  ReminderPausedUntil?: string;
  ReminderFrequencyDays?: number;
  NextReminderDate?: string;
  EscalationEnabled?: string;
  EscalationThresholdDays?: number;
  CollectionPriority?: string;
  Id?: string;
  Created?: string;
  Modified?: string;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

// Map SharePoint internal keys (field_*) to readable business names.
export function mapInvoiceFields(
  rawFields: Record<string, unknown>,
): InvoiceReminderItem {
  return {
    InvoiceNumber:
      readString(rawFields.LinkTitle) ?? readString(rawFields.Title),
    ClientName: readString(rawFields.field_1),
    ClientEmail: readString(rawFields.field_2),
    ProjectName: readString(rawFields.field_3),
    InvoiceDate: readString(rawFields.field_4),
    DueDate: readString(rawFields.field_5),
    Currency: readString(rawFields.field_6),
    Subtotal: readNumber(rawFields.field_7),
    TaxRate: readNumber(rawFields.field_8),
    TaxAmount: readNumber(rawFields.field_9),
    TotalAmount: readNumber(rawFields.field_10),
    AmountPaid: readNumber(rawFields.field_11),
    Balance: readNumber(rawFields.field_12),
    Status: readString(rawFields.field_13),
    PaymentTerms: readString(rawFields.field_14),
    PaymentMethod: readString(rawFields.field_15),
    PurchaseOrderNumber: readString(rawFields.field_16),
    SentDate: readString(rawFields.field_17),
    PaidDate: readString(rawFields.field_18),
    LastReminderDate: readString(rawFields.field_19),
    Owner: readString(rawFields.field_20),
    Notes: readString(rawFields.field_21),
    ReminderEnabled: readString(rawFields.field_22),
    DoNotContact: readString(rawFields.field_23),
    ReminderPausedUntil: readString(rawFields.field_24),
    ReminderFrequencyDays: readNumber(rawFields.field_25),
    NextReminderDate: readString(rawFields.field_26),
    EscalationEnabled: readString(rawFields.field_27),
    EscalationThresholdDays: readNumber(rawFields.field_28),
    CollectionPriority: readString(rawFields.field_29),
    Id: readString(rawFields.id),
    Created: readString(rawFields.Created),
    Modified: readString(rawFields.Modified),
  };
}
