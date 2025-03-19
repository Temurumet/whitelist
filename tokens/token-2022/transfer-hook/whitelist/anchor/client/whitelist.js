// Исправленная версия whitelist.js
const { Keypair, Connection, PublicKey, Transaction, TransactionInstruction, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');

// Загрузка кошелька
const keypairFile = process.argv[2] || '~/.config/solana/id.json';
const accountToWhitelist = process.argv[3];

if (!accountToWhitelist) {
  console.error('Usage: node whitelist.js [keypair_path] <account_pubkey>');
  process.exit(1);
}

// Загрузка кошелька
const loadKeypair = (path) => {
  try {
    const expanded = path.replace(/^~/, process.env.HOME);
    const secretKey = JSON.parse(fs.readFileSync(expanded));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch (e) {
    console.error('Error loading keypair:', e);
    process.exit(1);
  }
};

const wallet = loadKeypair(keypairFile);
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const programId = new PublicKey('6NiHr87RjVscpZLbxoqoAfLPJi8ijR1gsniq7TfkjWHx');

// Функция для создания инструкции add_to_whitelist
// SHA256("global:add_to_whitelist")[0..8]
const ADD_TO_WHITELIST_IX = Buffer.from([48, 26, 147, 95, 18, 42, 23, 29]);

async function addToWhitelist() {
  try {
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    console.log(`Adding account to whitelist: ${accountToWhitelist}`);
    
    // Найти PDA для белого списка
    const [whiteListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist')],
      programId
    );
    
    console.log(`Whitelist PDA: ${whiteListPDA.toString()}`);
    
    // Создать инструкцию
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: new PublicKey(accountToWhitelist), isSigner: false, isWritable: false },
        { pubkey: whiteListPDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }
      ],
      programId,
      data: ADD_TO_WHITELIST_IX
    });
    
    // Создать и отправить транзакцию
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Исправлено: используем signTransaction вместо sign
    transaction.sign(wallet); // Используем метод sign для Keypair
    
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    
    console.log(`Transaction sent: ${signature}`);
    await connection.confirmTransaction(signature);
    console.log('Transaction confirmed!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addToWhitelist();