const { Keypair, Connection, PublicKey, Transaction, clusterApiUrl } = require('@solana/web3.js');
const { 
  createTransferCheckedWithTransferHookInstruction, 
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const fs = require('fs');

// Константы
const PROGRAM_ID = "6NiHr87RjVscpZLbxoqoAfLPJi8ijR1gsniq7TfkjWHx";

// Параметры для перевода (настройте под свои нужды)
const MINT_ADDRESS = process.argv[2];
const DESTINATION_ADDRESS = process.argv[3];
const AMOUNT = process.argv[4] || "1"; // по умолчанию 1 токен
const DECIMALS = parseInt(process.argv[5] || "9"); // по умолчанию 9 знаков

if (!MINT_ADDRESS || !DESTINATION_ADDRESS) {
  console.error('Пожалуйста, укажите адрес минты и адрес получателя');
  console.error('Пример: node transfer-tokens.js <MINT_ADDRESS> <DESTINATION_ADDRESS> [AMOUNT] [DECIMALS]');
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

async function transferTokens() {
  try {
    const wallet = loadKeypair();
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    const mintAddress = new PublicKey(MINT_ADDRESS);
    const destinationAddress = new PublicKey(DESTINATION_ADDRESS);
    
    console.log(`Используется кошелек: ${wallet.publicKey.toString()}`);
    console.log(`Минта токена: ${mintAddress.toString()}`);
    console.log(`Адрес получателя: ${destinationAddress.toString()}`);
    console.log(`Сумма: ${AMOUNT} (с ${DECIMALS} десятичными знаками)`);
    
    // Находим PDA для ExtraAccountMetaList и белого списка
    const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('extra-account-metas'), mintAddress.toBuffer()],
      programId
    );
    
    const [whitelistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('white_list')], // используем правильный сид
      programId
    );
    
    console.log(`PDA для ExtraAccountMetaList: ${extraAccountMetaListPDA.toString()}`);
    console.log(`PDA для белого списка: ${whitelistPDA.toString()}`);
    
    // Получаем адреса токен-аккаунтов
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      destinationAddress,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log(`Исходный токен-аккаунт: ${sourceTokenAccount.toString()}`);
    console.log(`Целевой токен-аккаунт: ${destinationTokenAccount.toString()}`);
    
    // Проверяем существование токен-аккаунтов
    const sourceAccount = await connection.getAccountInfo(sourceTokenAccount);
    if (!sourceAccount) {
      console.error('Ошибка: Исходный токен-аккаунт не существует');
      return;
    }
    
    const destAccount = await connection.getAccountInfo(destinationTokenAccount);
    if (!destAccount) {
      console.error('Ошибка: Целевой токен-аккаунт не существует. Получатель должен создать ассоциированный токен-аккаунт.');
      return;
    }
    
    // Конвертируем сумму с учетом десятичных знаков
    const amountBigInt = BigInt(Math.floor(parseFloat(AMOUNT) * Math.pow(10, DECIMALS)));
    
    // Создаем инструкцию для перевода с transfer hook
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mintAddress,
      destinationTokenAccount,
      wallet.publicKey,
      amountBigInt,
      DECIMALS,
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
      programId,
      [extraAccountMetaListPDA, whitelistPDA]
    );
    
    // Создаем и отправляем транзакцию
    const transaction = new Transaction().add(transferInstruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Подписываем транзакцию
    transaction.sign(wallet);
    
    // Отправляем транзакцию
    console.log("Отправка транзакции...");
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true // иногда помогает с ошибками симуляции
    });
    
    console.log("Ожидание подтверждения...");
    await connection.confirmTransaction(signature);
    
    console.log(`Транзакция успешно выполнена: ${signature}`);
    console.log(`Ссылка на Solscan: https://devnet.solscan.io/tx/${signature}`);
    
  } catch (error) {
    console.error('Ошибка при переводе токенов:', error);
    
    // Дополнительная информация об ошибке
    if (error.logs) {
      console.error('Логи программы:');
      error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
    }
  }
}

transferTokens();