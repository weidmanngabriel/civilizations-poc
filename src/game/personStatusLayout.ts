export const PERSON_STATUS_ICON_SPACING = 2.7;

export const personStatusBubbleWidth = (iconCount: number): number => {
  if (iconCount <= 1) return 5.25;
  if (iconCount === 2) return 8;
  return 10.75;
};

export const personStatusIconCenters = (iconCount: number): number[] => {
  if (iconCount <= 0) return [];
  const center = (iconCount - 1) / 2;
  return Array.from(
    { length: iconCount },
    (_, index) => (index - center) * PERSON_STATUS_ICON_SPACING,
  );
};
