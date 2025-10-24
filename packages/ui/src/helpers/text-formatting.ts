// Helper function to format snake_case to Title Case
export function snakeCaseToTitleCase(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatChainage(chainage: number): string {
  const kilometers = Math.floor(chainage / 1000);
  const meters = chainage % 1000;
  return `${kilometers}+${String(meters).padStart(3, '0')}`;
}
