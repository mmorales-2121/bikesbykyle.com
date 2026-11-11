// Edit this file to change what customers see: name, services, hours.
export const business = {
  name: "Bikes By Kyle",
  tagline: "Austin's concierge bike service. Book online; prices are labor only, parts are extra.",
  timeZone: "America/Chicago",
  currency: "usd",
  // How far ahead customers can book, and the minimum notice.
  maxDaysAhead: 30,
  minNoticeHours: 12,
  // Start times are offered every N minutes.
  slotStepMinutes: 30,
  // 0 = Sunday ... 6 = Saturday. Omit a day to close it.
  hours: {
    1: { open: "09:00", close: "17:00" },
    2: { open: "09:00", close: "17:00" },
    3: { open: "09:00", close: "17:00" },
    4: { open: "09:00", close: "17:00" },
    5: { open: "09:00", close: "17:00" },
    6: { open: "08:00", close: "15:00" },
    0: { open: "08:00", close: "15:00" },
  } as Record<number, { open: string; close: string }>,
};

export type Service = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  // Bench time blocked on your calendar for this job.
  durationMinutes: number;
};

// Modeled on a typical bike shop service menu. Prices are placeholders; durations are rough industry averages.
// Small one-off repairs (cables, flats, adjustments) go under "Repair assessment" and are quoted in the shop.
export const services: Service[] = [
  { id: "safety-check", category: "Tune-ups", name: "Safety check & lube", description: "Brake and shifting adjustment, tire check, chain clean and lube.", priceCents: 7500, durationMinutes: 45 },
  { id: "pre-race", category: "Tune-ups", name: "Pre-race check", description: "Safety check plus a full once-over before your event.", priceCents: 8000, durationMinutes: 45 },
  { id: "complete-tune", category: "Tune-ups", name: "Complete tune-up", description: "Full adjustment of brakes, gears, wheels, headset and bottom bracket.", priceCents: 10000, durationMinutes: 90 },
  { id: "deluxe-road", category: "Deluxe tune-ups", name: "Deluxe road tune", description: "Complete tune-up plus drivetrain deep clean and new cables.", priceCents: 16000, durationMinutes: 180 },
  { id: "overhaul-rim", category: "Overhauls", name: "Road / cross, rim brake", description: "Full teardown, clean, and rebuild.", priceCents: 32000, durationMinutes: 240 },
  { id: "overhaul-hydraulic", category: "Overhauls", name: "Road / cross, hydraulic brake", description: "Full teardown and rebuild, including brake bleed.", priceCents: 37000, durationMinutes: 300 },
  { id: "overhaul-ebike", category: "Overhauls", name: "E-bike / proprietary", description: "Full overhaul for e-bikes and bikes with proprietary parts.", priceCents: 50000, durationMinutes: 420 },
  { id: "assemble-boxed", category: "Box & build", name: "Assemble boxed bike", description: "Build and tune a bike that arrived in a box.", priceCents: 12500, durationMinutes: 90 },
  { id: "box-shipping", category: "Box & build", name: "Box bike for shipping", description: "Pack your bike safely for shipping or travel.", priceCents: 12500, durationMinutes: 60 },
  { id: "assessment", category: "Repairs", name: "Repair assessment", description: "Bring it in for a flat, cable, brake or shifting issue. We'll quote the repair before starting.", priceCents: 2500, durationMinutes: 30 },
];

export const categories = [...new Set(services.map((s) => s.category))];

export const getService = (id: string) => services.find((s) => s.id === id);

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: business.currency.toUpperCase() }).format(cents / 100);
