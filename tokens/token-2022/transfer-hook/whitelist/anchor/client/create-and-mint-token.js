const { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram, clusterApiUrl } = require('@solana/web3.js');
const { 
  createInitializeMintInstruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMintLen,
  ExtensionType
} = require('@solana/spl-token');
const fs = require('fs');

// Параметры
const DECIMAL_PLACES = 9;
const MINT_AMOUNT = 1000000; // 1 миллион токенов

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

async function createAndMintToken() {
  try {
    const wallet = loadKeypair();
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    
    // Создаем keypair для новой минты
    const mintKeypair = Keypair.generate();
    console.log(`Адрес минты (сохраните его!): ${mintKeypair.publicKey.toString()}`);
    
    // Рассчитываем размер минты
    const mintLen = getMintLen([]);
    
    // Получаем минимальный баланс для минты
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    
    // Создаем инструкцию для выделения места для минты
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: mintLamports,
      space: mintLen,
      programId: TOKEN_2022_PROGRAM_ID
    });
    
    // Инициализируем минту
    const initMintInstruction = createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMAL_PLACES,
      wallet.publicKey,
      wallet.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Создаем токен-аккаунт для владельца
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const createAssociatedTokenAccountIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      associatedTokenAccount,
      wallet.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Минтим токены
    const mintToInstruction = createMintToInstruction(
      mintKeypair.publicKey,
      associatedTokenAccount,
      wallet.publicKey,
      MINT_AMOUNT * Math.pow(10, DECIMAL_PLACES),
      [],
      TOKEN_2022_PROGRAM_ID
    );
    
    // Объединяем все инструкции в одну транзакцию
    const transaction = new Transaction()
      .add(createAccountInstruction)
      .add(initMintInstruction)
      .add(createAssociatedTokenAccountIx)
      .add(mintToInstruction);
    
    // Отправляем транзакцию
    console.log("Отправка транзакции...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet, mintKeypair]
    );
    
    console.log(`Токен успешно создан и заминчен!`);
    console.log(`Подпись транзакции: ${signature}`);
    console.log(`Адрес минты: ${mintKeypair.publicKey.toString()}`);
    console.log(`Адрес токен-аккаунта: ${associatedTokenAccount.toString()}`);
    console.log(`Количество заминченных токенов: ${MINT_AMOUNT}`);
    
  } catch (error) {
    console.error('Ошибка при создании и минте токена:', error);
  }
}

createAndMintToken();