import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import path from 'path';

export const getKeypair = (filePath: string): Keypair => {
  const secretKey = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
};

export const walletKeypair = getKeypair(path.resolve(__dirname, '../../../wallet.json'));