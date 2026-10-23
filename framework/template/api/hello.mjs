// GET /api/hello → { message }. Dev-only: npm run dev answers it; production needs a real backend.
export function GET() {
  return { message: 'Built with Pith: no build step, no runtime dependencies.' };
}
