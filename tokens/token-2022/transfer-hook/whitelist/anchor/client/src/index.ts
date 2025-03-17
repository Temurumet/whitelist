import { Command } from 'commander';
import { addToWhitelist } from './commands/addToWhitelist';
import { transfer } from './commands/transfer';
import { PublicKey } from '@solana/web3.js';

const program = new Command();

program
  .command('add-to-whitelist <account>')
  .description('Add an account to the whitelist')
  .action(async (account) => {
    const newAccount = new PublicKey(account);
    await addToWhitelist(newAccount);
  });

program
  .command('transfer <destination> <amount> <decimals>')
  .description('Transfer tokens with transfer hook')
  .action(async (destination, amount, decimals) => {
    const destPubkey = new PublicKey(destination);
    await transfer(destPubkey, Number(amount), Number(decimals));
  });

program.parse(process.argv);