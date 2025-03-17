import { connection } from '../utils/connection';
import { walletKeypair } from '../utils/keys';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Program, Provider, web3 } from '@coral-xyz/anchor';
import { TransferHook } from '../../target/types/transfer_hook';
import idl from '../../target/idl/transfer_hook.json';
import { createTransferCheckedWithTransferHookInstruction } from '@solana/spl-token';

const programId = new PublicKey(idl.metadata.address);
const provider = new Provider(connection, walletKeypair, {});
const program = new Program(idl as any, programId, provider) as Program<TransferHook>;

export const transfer = async (destination: PublicKey, amount: number, decimals: number) => {
  const [extraAccountMetaListPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('extra-account-metas'), mint.publicKey.toBuffer()],
    program.programId
  );

  const [whiteListPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('whitelist')],
    program.programId
  );

  const sourceTokenAccount = await getAssociatedTokenAddress(
    mint.publicKey,
    walletKeypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const destinationTokenAccount = await getAssociatedTokenAddress(
    mint.publicKey,
    destination,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
    connection,
    sourceTokenAccount,
    mint.publicKey,
    destinationTokenAccount,
    walletKeypair.publicKey,
    amount,
    decimals,
    [],
    'confirmed',
    TOKEN_2022_PROGRAM_ID,
    program.programId,
    [extraAccountMetaListPDA, whiteListPDA]
  );

  const transaction = new Transaction().add(transferInstruction);
  const txSig = await provider.sendAndConfirm(transaction, [walletKeypair]);
  console.log(`Transfer Successful: ${txSig}`);
};