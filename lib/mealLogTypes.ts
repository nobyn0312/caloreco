export type MealLog = {
  id: number;
  rawInput: string;
  /** Prisma Json として返るため unknown */
  result: unknown;
  createdAt: string;
};
