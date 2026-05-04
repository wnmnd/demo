export type IndustryKey =
  | "Healthcare"
  | "F&B"
  | "Retail"
  | "E-commerce"
  | "SaaS"
  | "Manufacturing"
  | "Real Estate";

export type TemplateDef = {
  id: string;
  name: string;
  requiredColumns: string[];
  sampleRows: Record<string, string | number>[];
};

export const templatesByIndustry: Record<IndustryKey, TemplateDef[]> = {
  Healthcare: [
    {
      id: "hospital-revenue",
      name: "Hospital Revenue Analysis",
      requiredColumns: ["Date", "Department", "Revenue", "Patient Count", "Procedure Type"],
      sampleRows: [
        { Date: "2026-01-01", Department: "Cardiology", Revenue: 18500, "Patient Count": 22, "Procedure Type": "Angioplasty" },
        { Date: "2026-01-02", Department: "Emergency", Revenue: 27500, "Patient Count": 43, "Procedure Type": "Trauma" },
        { Date: "2026-01-03", Department: "Pediatrics", Revenue: 9200, "Patient Count": 28, "Procedure Type": "Consultation" }
      ]
    },
    {
      id: "clinic-mix",
      name: "Clinic Patient & Revenue Mix",
      requiredColumns: ["Date", "Department", "Revenue", "Patient Count", "Procedure Type"],
      sampleRows: []
    },
    {
      id: "pharmacy-sales",
      name: "Pharmacy Sales Breakdown",
      requiredColumns: ["Date", "Department", "Revenue", "Patient Count", "Procedure Type"],
      sampleRows: []
    }
  ],
  "F&B": [
    {
      id: "fnb-sales",
      name: "Restaurant Sales Performance",
      requiredColumns: ["Date", "Category", "Revenue", "Order Count", "Hour"],
      sampleRows: [
        { Date: "2026-01-01", Category: "Pizza", Revenue: 2400, "Order Count": 62, Hour: 19 },
        { Date: "2026-01-01", Category: "Burgers", Revenue: 1700, "Order Count": 53, Hour: 13 },
        { Date: "2026-01-01", Category: "Drinks", Revenue: 620, "Order Count": 81, Hour: 20 }
      ]
    }
  ],
  Retail: [{ id: "retail", name: "Retail Sales & Inventory", requiredColumns: ["Date", "Store", "Revenue", "Units", "Margin"], sampleRows: [] }],
  "E-commerce": [{ id: "ecom", name: "E-commerce Orders & Conversion", requiredColumns: ["Date", "Channel", "Revenue", "Orders", "Conversion"], sampleRows: [] }],
  SaaS: [{ id: "saas", name: "SaaS MRR & Churn", requiredColumns: ["Date", "Plan", "MRR", "New Customers", "Churn"], sampleRows: [] }],
  Manufacturing: [{ id: "mfg", name: "Production & Quality", requiredColumns: ["Date", "Line", "Output", "Defects", "Cost Per Unit"], sampleRows: [] }],
  "Real Estate": [{ id: "real-estate", name: "Property Sales Analysis", requiredColumns: ["Date", "Location", "Price", "Units", "Type"], sampleRows: [] }]
};
