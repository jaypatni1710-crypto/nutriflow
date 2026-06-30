export const GOAL_OPTIONS = [
  'Weight Loss', 'Weight Gain', 'Muscle Gain', 'Fat Loss', 'Diabetes Management',
  'PCOS Management', 'Thyroid Management', 'General Wellness', 'Other',
];

export const MEDICAL_CONDITIONS = [
  'Diabetes', 'Thyroid', 'PCOS', 'Hypertension', 'High Cholesterol', 'Fatty Liver',
  'Pregnancy', 'Bariatric', 'IBS', 'Kidney Disease', 'Other',
];

export const DIET_TYPES = [
  'Vegetarian', 'Non Vegetarian', 'Eggetarian', 'Vegan', 'Jain', 'Keto', 'Other',
];

export const STRESS_LEVELS = ['Low', 'Moderate', 'High'];

export const ACTIVITY_LEVELS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Athlete'];

export const LAB_REPORT_TYPES = ['CBC', 'HbA1c', 'Thyroid', 'Vitamin D', 'Vitamin B12', 'Lipid Profile', 'Prescription', 'Family Medical History Report', 'Other'];

export const FOOD_FREQUENCY_OPTIONS = ['Daily', '4-6 Times Per Week', '2-3 Times Per Week', 'Weekly', 'Monthly', 'Rarely', 'Never'];

export const FOOD_FREQUENCY_ITEMS: { key: string; label: string }[] = [
  { key: 'fruits', label: 'Fruits' },
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'dairy_products', label: 'Dairy Products' },
  { key: 'fast_food', label: 'Fast Food' },
  { key: 'sweets', label: 'Sweets' },
  { key: 'sugary_drinks', label: 'Sugary Drinks' },
  { key: 'tea_coffee', label: 'Tea/Coffee' },
  { key: 'fried_foods', label: 'Fried Foods' },
  { key: 'bakery_products', label: 'Bakery Products' },
  { key: 'packaged_foods', label: 'Packaged Foods' },
];

export const STATUS_OPTIONS = ['active', 'inactive', 'completed', 'on_hold'];
export const STATUS_LABELS: Record<string, string> = {
  active: 'Active', inactive: 'Inactive', completed: 'Completed', on_hold: 'On Hold',
};

export const PHOTO_VIEW_TYPES = ['Front', 'Side', 'Back'];

export const COMMUNICATION_TYPES = [
  'WhatsApp Message', 'Diet Plan Shared', 'Follow-Up Reminder', 'Progress Report Shared',
  'Consultation Summary', 'Payment Reminder', 'Custom Note',
];

export const SUGGESTED_TAGS = [
  'Weight Loss', 'Weight Gain', 'PCOS', 'Diabetes', 'Thyroid', 'Pregnancy', 'Bariatric', 'VIP', 'High Priority',
];

export const STEP_LABELS = ['Client Details', 'Body & Lifestyle', 'Health & Medical'];
