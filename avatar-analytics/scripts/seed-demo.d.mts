export const DEMO_PASSWORD: string
export function seedDemo(options?: { days?: number; log?: (message: string) => void }): Promise<{ northline: { id: string }; harbor: { id: string }; calls: number }>
