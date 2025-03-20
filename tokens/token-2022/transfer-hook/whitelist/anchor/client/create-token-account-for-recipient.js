const { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram, clusterApiUrl } = require('@solana/web3.js');
const { 
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const fs = require('fs');

// Параметры
const MINT_ADDRESS = process.argv[2];
const RECIPIENT_ADDRESS = process.argv[3];

if (!MINT_ADDRESS || !RECIPIENT_ADDRESS) {
  console.error('Пожалуйста, укажите адрес минты и адрес получателя');
  console.error('Пример: node create-token-account-for-recipient.js <MINT_ADDRESS> <RECIPIENT_ADDRESS>');
  process.exit(1);
}

// Загрузка кошелька
const loadKeypair = () => {
  try {
    const home = process.env.HOME;
    const keypairPath = `${home}/.config/solana/id.json`;
    const keypairString = fs.readFileSync(keypairPath, 'utf-8');
    const keypairData = JSON.parse(keypairString);
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Ошибка при загрузке кошелька:', error);
    process.exit(1);
  }
};

async function createTokenAccountForRecipient() {
  try {
    const wallet = loadKeypair();
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const mintAddress = new PublicKey(MINT_ADDRESS);
    const recipientAddress = new PublicKey(RECIPIENT_ADDRESS);
    
    console.log(`Используется кошелек: ${wallet.publicKey.toString()}`);
    console.log(`Минта токена: ${mintAddress.toString()}`);
    console.log(`Адрес получателя: ${recipientAddress.toString()}`);
    
    // Получаем адрес токен-аккаунта для получателя
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      recipientAddress,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log(`Создание токен-аккаунта: ${recipientTokenAccount.toString()}`);
    
    // Создаем инструкцию для создания ассоциированного токен-аккаунта
    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      recipientTokenAccount,
      recipientAddress,
      mintAddress,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Создаем и отправляем транзакцию
    const transaction = new Transaction().add(createTokenAccountIx);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Отправляем транзакцию
    console.log("Отправка транзакции...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );
    
    console.log(`Токен-аккаунт успешно создан для получателя: ${recipientTokenAccount.toString()}`);
    console.log(`Транзакция: ${signature}`);
    
  } catch (error) {
    console.error('Ошибка при создании токен-аккаунта:', error);
  }
}

createTokenAccountForRecipient();