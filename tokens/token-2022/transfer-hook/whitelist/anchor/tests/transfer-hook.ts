import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  getMint,
} from '@solana/spl-token';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import type { TransferHook } from '../target/types/transfer_hook';

describe('transfer-hook', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TransferHook as Program<TransferHook>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // Keypairs and addresses
  const mint = new Keypair();
  const decimals = 9;
  const recipient = Keypair.generate();
  let sourceTokenAccount: anchor.web3.PublicKey;
  let destinationTokenAccount: anchor.web3.PublicKey;

  before(() => {
    // Pre-calculate token accounts
    sourceTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    destinationTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      recipient.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
  });

  it('1. Create Mint Account with Transfer Hook Extension', async () => {
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        wallet.publicKey,
        program.programId,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer, mint]);
    console.log(`Mint Created: ${txSig}`);
  });

  it('2. Create Token Accounts and Mint Tokens', async () => {
    const amount = 100 * 10 ** decimals;
    const space = 165; // Token account size
    const lamportsPerAccount = await connection.getMinimumBalanceForRentExemption(space);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: sourceTokenAccount,
        lamports: lamportsPerAccount,
      }),
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: destinationTokenAccount,
        lamports: lamportsPerAccount,
      }),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToInstruction(
        mint.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer]);
    console.log(`Token Accounts Created: ${txSig}`);

    // Verify accounts
    const sourceAccount = await connection.getAccountInfo(sourceTokenAccount);
    const destAccount = await connection.getAccountInfo(destinationTokenAccount);
    if (!sourceAccount || !destAccount) {
      throw new Error("Failed to create token accounts");
    }
  });

  it('3. Create ExtraAccountMetaList Account', async () => {
    const [extraAccountMetaListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
      program.programId
    );

    const [whiteListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("whitelist")],
      program.programId
    );

    const transaction = await program.methods
      .initializeExtraAccountMetaList()
      .accounts({
        payer: wallet.publicKey,
        extra_account_meta_list: extraAccountMetaListPDA,
        mint: mint.publicKey,
        system_program: anchor.web3.SystemProgram.programId,
        white_list: whiteListPDA,
      })
      .transaction();

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer]);
    console.log(`ExtraAccountMetaList Created: ${txSig}`);
  });

  it('4. Add account to white list', async () => {
    const [whiteListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("whitelist")],
        program.programId
    );

    // Явно указываем AccountMeta
    const newAccountMeta = {
        pubkey: destinationTokenAccount,
        isWritable: false,
        isSigner: false
    };

    const transaction = await program.methods
        .addToWhitelist()
        .accounts({
            newAccount: destinationTokenAccount, // Только публичный ключ
            whitelist: whiteListPDA,
            authority: wallet.publicKey,
        })
        .remainingAccounts([newAccountMeta]) // Явное добавление метаданных
        .transaction();

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer]);
    console.log(`Added to Whitelist: ${txSig}`);
  });

  it('5. Execute Transfer with Hook', async () => {
    const amount = 1 * 10 ** decimals;
    const [extraAccountMetaListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
      program.programId
    );

    const [whiteListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("whitelist")],
      program.programId
    );

    // Get mint info
    const mintAccount = await getMint(
      connection,
      mint.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Create transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mint.publicKey,
      destinationTokenAccount,
      wallet.publicKey,
      amount,
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
      program.programId,
      [extraAccountMetaListPDA, whiteListPDA]
    );

    const transaction = new Transaction().add(transferInstruction);
    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true, commitment: 'confirmed' }
    );

    console.log(`Transfer Successful: ${txSig}`);

    // Verify balances
    const sourceAccount = await connection.getTokenAccountBalance(sourceTokenAccount);
    const destAccount = await connection.getTokenAccountBalance(destinationTokenAccount);
    if (sourceAccount.value.uiAmount !== 99 || destAccount.value.uiAmount !== 1) {
      throw new Error("Invalid token balances after transfer");
    }
  });

  it('6. Add specific account to whitelist via CLI', async () => {
    const specificAccount = new anchor.web3.PublicKey('9JpR9tq25e9DwJPrv8KaXCtUHZ9P193brHQs4ru2z5Gn');
    
    const [whiteListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("whitelist")],
      program.programId
    );
    
    const tx = await program.methods
      .addToWhitelist()
      .accounts({
        newAccount: specificAccount,
        whiteList: whiteListPDA,
        authority: wallet.publicKey,
      })
      .transaction();
    
    const txSig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log(`Added specific account to Whitelist: ${txSig}`);
  });
});