"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
describe('transfer-hook', () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.TransferHook;
    const wallet = provider.wallet;
    const connection = provider.connection;
    // Generate keypair to use as address for the transfer-hook enabled mint
    const mint = new web3_js_1.Keypair();
    const decimals = 9;
    // Sender token account address
    const sourceTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mint.publicKey, wallet.publicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
    // Recipient token account address
    const recipient = web3_js_1.Keypair.generate();
    const destinationTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mint.publicKey, recipient.publicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
    it('Create Mint Account with Transfer Hook Extension', () => __awaiter(void 0, void 0, void 0, function* () {
        const extensions = [spl_token_1.ExtensionType.TransferHook];
        const mintLen = (0, spl_token_1.getMintLen)(extensions);
        const lamports = yield provider.connection.getMinimumBalanceForRentExemption(mintLen);
        const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: mint.publicKey,
            space: mintLen,
            lamports: lamports,
            programId: spl_token_1.TOKEN_2022_PROGRAM_ID,
        }), (0, spl_token_1.createInitializeTransferHookInstruction)(mint.publicKey, wallet.publicKey, program.programId, // Transfer Hook Program ID
        spl_token_1.TOKEN_2022_PROGRAM_ID), (0, spl_token_1.createInitializeMintInstruction)(mint.publicKey, decimals, wallet.publicKey, null, spl_token_1.TOKEN_2022_PROGRAM_ID));
        const txSig = yield (0, web3_js_1.sendAndConfirmTransaction)(provider.connection, transaction, [wallet.payer, mint]);
        console.log(`Transaction Signature: ${txSig}`);
    }));
    // Create the two token accounts for the transfer-hook enabled mint
    // Fund the sender token account with 100 tokens
    it('Create Token Accounts and Mint Tokens', () => __awaiter(void 0, void 0, void 0, function* () {
        // 100 tokens
        const amount = 100 * Math.pow(10, decimals);
        const transaction = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(wallet.publicKey, sourceTokenAccount, wallet.publicKey, mint.publicKey, spl_token_1.TOKEN_2022_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID), (0, spl_token_1.createAssociatedTokenAccountInstruction)(wallet.publicKey, destinationTokenAccount, recipient.publicKey, mint.publicKey, spl_token_1.TOKEN_2022_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID), (0, spl_token_1.createMintToInstruction)(mint.publicKey, sourceTokenAccount, wallet.publicKey, amount, [], spl_token_1.TOKEN_2022_PROGRAM_ID));
        const txSig = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [wallet.payer], { skipPreflight: true });
        console.log(`Transaction Signature: ${txSig}`);
    }));
    // Account to store extra accounts required by the transfer hook instruction
    it('Create ExtraAccountMetaList Account', () => __awaiter(void 0, void 0, void 0, function* () {
        const initializeExtraAccountMetaListInstruction = yield program.methods
            .initializeExtraAccountMetaList()
            .accounts({
            mint: mint.publicKey,
        })
            .instruction();
        const transaction = new web3_js_1.Transaction().add(initializeExtraAccountMetaListInstruction);
        const txSig = yield (0, web3_js_1.sendAndConfirmTransaction)(provider.connection, transaction, [wallet.payer], { skipPreflight: true, commitment: 'confirmed' });
        console.log('Transaction Signature:', txSig);
    }));
    it('Add account to white list', () => __awaiter(void 0, void 0, void 0, function* () {
        const addAccountToWhiteListInstruction = yield program.methods
            .addToWhitelist()
            .accounts({
            newAccount: destinationTokenAccount,
            signer: wallet.publicKey,
        })
            .instruction();
        const transaction = new web3_js_1.Transaction().add(addAccountToWhiteListInstruction);
        const txSig = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [wallet.payer], { skipPreflight: true });
        console.log('White Listed:', txSig);
    }));
    it('Transfer Hook with Extra Account Meta', () => __awaiter(void 0, void 0, void 0, function* () {
        // 1 tokens
        const amount = 1 * Math.pow(10, decimals);
        const bigIntAmount = BigInt(amount);
        // Standard token transfer instruction
        const transferInstruction = yield (0, spl_token_1.createTransferCheckedWithTransferHookInstruction)(connection, sourceTokenAccount, mint.publicKey, destinationTokenAccount, wallet.publicKey, bigIntAmount, decimals, [], 'confirmed', spl_token_1.TOKEN_2022_PROGRAM_ID);
        const transaction = new web3_js_1.Transaction().add(transferInstruction);
        const txSig = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [wallet.payer], { skipPreflight: true });
        console.log('Transfer Checked:', txSig);
    }));
});
