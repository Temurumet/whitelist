import { Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import path from 'path';

export const getKeypair = (filePath: string): Keypair => {
  try {
    const secretKey = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch (error) {
    console.error(`Error loading keypair from ${filePath}:`, error);
    throw new Error(`Failed to load keypair from ${filePath}. Make sure the file exists and contains a valid JSON array of numbers.`);
  }
};

// Попытка найти wallet.json в разных местах
export const findWalletPath = (): string => {
  const possiblePaths = [
    path.resolve(__dirname, '../../../wallet.json'),
    path.resolve(__dirname, '../../wallet.json'),
    path.resolve(__dirname, '../wallet.json'),
    path.resolve(process.cwd(), 'wallet.json')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Found wallet at: ${p}`);
      return p;
    }
  }
  
  throw new Error('wallet.json file not found. Please create one using "solana-keygen new -o wallet.json"');
};

export const walletKeypair = getKeypair(findWalletPath());