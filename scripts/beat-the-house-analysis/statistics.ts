export type Sample = {
  readonly returnedHalfUnits: number;
  readonly profitHalfUnits: number;
  readonly stakeHalfUnits: number;
  readonly rounds: number;
  readonly hands: number;
};
export type SummaryStatistics = {
  readonly meanReturned: number;
  readonly meanProfit: number;
  readonly standardDeviation: number | null;
  readonly standardError: number | null;
  readonly sampleSize: number;
  readonly totalRounds: number;
  readonly totalHands: number;
};

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length);

export const calculateStatistics = (samples: readonly Sample[]): SummaryStatistics => {
  const returned = samples.map((sample) => sample.returnedHalfUnits / sample.stakeHalfUnits);
  const profit = samples.map((sample) => sample.profitHalfUnits / sample.stakeHalfUnits);
  const meanReturned = mean(returned);
  const meanProfit = mean(profit);
  if (samples.length < 2)
    return {
      meanReturned,
      meanProfit,
      standardDeviation: null,
      standardError: null,
      sampleSize: samples.length,
      totalRounds: samples.reduce((total, sample) => total + sample.rounds, 0),
      totalHands: samples.reduce((total, sample) => total + sample.hands, 0),
    };
  const standardDeviation = Math.sqrt(mean(returned.map((value) => (value - meanReturned) ** 2)) * (samples.length / (samples.length - 1)));
  return {
    meanReturned,
    meanProfit,
    standardDeviation,
    standardError: standardDeviation / Math.sqrt(samples.length),
    sampleSize: samples.length,
    totalRounds: samples.reduce((total, sample) => total + sample.rounds, 0),
    totalHands: samples.reduce((total, sample) => total + sample.hands, 0),
  };
};
