export const DEMO_PASSWORD: string
export function seedDemo(options?: { days?: number; log?: (message: string) => void; glass?: boolean; agency?: boolean }): Promise<{ northline: { id: string }; harbor: { id: string }; calls: number }>
