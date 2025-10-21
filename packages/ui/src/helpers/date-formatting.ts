// Helper function to format dates to a consistent format
export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
