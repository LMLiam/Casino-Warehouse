import { performance } from 'node:perf_hooks';
import { loadConfig, parseArguments } from './config';
import { formatOutput, createOutput } from './output';
import { simulate } from './simulate';

const main = (): void => {
  const argumentsValue = parseArguments(process.argv.slice(2));
  const config = loadConfig(argumentsValue.config);
  const started = performance.now();
  const profiles = simulate(config);
  process.stdout.write(`${formatOutput(createOutput(config, profiles, Math.round(performance.now() - started)), argumentsValue.format)}\n`);
};

main();
