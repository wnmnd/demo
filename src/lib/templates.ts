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
  sampleFile: string;
};

export const templatesByIndustry: Record<IndustryKey, TemplateDef[]> = {
  Healthcare: [
    {
      id: "hospital-revenue",
      name: "Hospital Revenue Analysis",
      requiredColumns: ["Date", "Department", "Revenue", "Patient Count", "Procedure Type"],
      sampleFile: "/samples/healthcare-hospital-revenue.csv",
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
      sampleFile: "/samples/healthcare-clinic-mix.csv",
      sampleRows: [
        { Date: "2026-02-01", Department: "Dermatology", Revenue: 4200, "Patient Count": 18, "Procedure Type": "Laser" },
        { Date: "2026-02-01", Department: "General", Revenue: 3150, "Patient Count": 34, "Procedure Type": "Consultation" },
        { Date: "2026-02-02", Department: "Pediatrics", Revenue: 2800, "Patient Count": 21, "Procedure Type": "Vaccination" }
      ]
    },
    {
      id: "pharmacy-sales",
      name: "Pharmacy Sales Breakdown",
      requiredColumns: ["Date", "Department", "Revenue", "Patient Count", "Procedure Type"],
      sampleFile: "/samples/healthcare-pharmacy-sales.csv",
      sampleRows: [
        { Date: "2026-03-01", Department: "Pharmacy", Revenue: 5600, "Patient Count": 77, "Procedure Type": "Prescription" },
        { Date: "2026-03-02", Department: "Pharmacy", Revenue: 6100, "Patient Count": 83, "Procedure Type": "OTC" },
        { Date: "2026-03-03", Department: "Pharmacy", Revenue: 5900, "Patient Count": 79, "Procedure Type": "Prescription" }
      ]
    }
  ],
  "F&B": [
    {
      id: "fnb-sales",
      name: "Restaurant Sales Performance",
      requiredColumns: ["Date", "Category", "Revenue", "Order Count", "Hour"],
      sampleFile: "/samples/fnb-sales.csv",
      sampleRows: [
        { Date: "2026-01-01", Category: "Pizza", Revenue: 2400, "Order Count": 62, Hour: 19 },
        { Date: "2026-01-01", Category: "Burgers", Revenue: 1700, "Order Count": 53, Hour: 13 },
        { Date: "2026-01-01", Category: "Drinks", Revenue: 620, "Order Count": 81, Hour: 20 }
      ]
    }
  ],
  Retail: [
    {
      id: "retail",
      name: "Retail Sales & Inventory",
      requiredColumns: ["Date", "Store", "Revenue", "Units", "Margin"],
      sampleFile: "/samples/retail-sales-inventory.csv",
      sampleRows: [
        { Date: "2026-01-05", Store: "Downtown", Revenue: 9800, Units: 340, Margin: 0.31 },
        { Date: "2026-01-05", Store: "Mall", Revenue: 7600, Units: 265, Margin: 0.27 },
        { Date: "2026-01-06", Store: "Airport", Revenue: 5400, Units: 190, Margin: 0.35 }
      ]
    }
  ],
  "E-commerce": [
    {
      id: "ecom",
      name: "E-commerce Orders & Conversion",
      requiredColumns: ["Date", "Channel", "Revenue", "Orders", "Conversion"],
      sampleFile: "/samples/ecommerce-orders-conversion.csv",
      sampleRows: [
        { Date: "2026-01-10", Channel: "Organic", Revenue: 12400, Orders: 230, Conversion: 0.034 },
        { Date: "2026-01-10", Channel: "Paid", Revenue: 9100, Orders: 162, Conversion: 0.027 },
        { Date: "2026-01-11", Channel: "Email", Revenue: 4200, Orders: 88, Conversion: 0.051 }
      ]
    }
  ],
  SaaS: [
    {
      id: "saas",
      name: "SaaS MRR & Churn",
      requiredColumns: ["Date", "Plan", "MRR", "New Customers", "Churn"],
      sampleFile: "/samples/saas-mrr-churn.csv",
      sampleRows: [
        { Date: "2026-01-01", Plan: "Starter", MRR: 24000, "New Customers": 32, Churn: 0.045 },
        { Date: "2026-01-01", Plan: "Pro", MRR: 41000, "New Customers": 19, Churn: 0.029 },
        { Date: "2026-01-01", Plan: "Enterprise", MRR: 36000, "New Customers": 4, Churn: 0.011 }
      ]
    }
  ],
  Manufacturing: [
    {
      id: "mfg",
      name: "Production & Quality",
      requiredColumns: ["Date", "Line", "Output", "Defects", "Cost Per Unit"],
      sampleFile: "/samples/manufacturing-production-quality.csv",
      sampleRows: [
        { Date: "2026-01-20", Line: "A", Output: 1200, Defects: 18, "Cost Per Unit": 4.2 },
        { Date: "2026-01-20", Line: "B", Output: 980, Defects: 22, "Cost Per Unit": 4.8 },
        { Date: "2026-01-21", Line: "C", Output: 1100, Defects: 15, "Cost Per Unit": 4.4 }
      ]
    }
  ],
  "Real Estate": [
    {
      id: "real-estate",
      name: "Property Sales Analysis",
      requiredColumns: ["Date", "Location", "Price", "Units", "Type"],
      sampleFile: "/samples/realestate-property-sales.csv",
      sampleRows: [
        { Date: "2026-02-12", Location: "Downtown", Price: 420000, Units: 3, Type: "Condo" },
        { Date: "2026-02-13", Location: "Suburb", Price: 310000, Units: 4, Type: "Townhouse" },
        { Date: "2026-02-14", Location: "Waterfront", Price: 680000, Units: 1, Type: "Villa" }
      ]
    }
  ]
};
