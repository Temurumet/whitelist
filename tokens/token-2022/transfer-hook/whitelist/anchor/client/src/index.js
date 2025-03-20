const { Connection, PublicKey, Keypair, clusterApiUrl } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Константы
const PROGRAM_ID_STRING = '6NiHr87RjVscpZLbxoqoAfLPJi8ijR1gsniq7TfkjWHx';
const PROGRAM_ID = new anchor.web3.PublicKey(PROGRAM_ID_STRING);

// Объявим переменные глобально
let walletKeypair;
let connection;
let program;

// Загружаем IDL для программы
const IDL = {
  "version": "0.1.0",
  "name": "transfer_hook",
  "instructions": [
    {
      "name": "initializeExtraAccountMetaList",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "extraAccountMetaList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whiteList",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "transferHook",
      "accounts": [
        {
          "name": "sourceToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "destinationToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "extraAccountMetaList",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whiteList",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addToWhitelist",
      "accounts": [
        {
          "name": "newAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whiteList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "WhiteList",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "whiteList",
            "type": {
              "vec": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "IsNotCurrentlyTransferring",
      "msg": "The token is not currently transferring"
    }
  ]
};

// Утилиты для работы с кошельком
function findWalletPath() {
  const possiblePaths = [
    path.resolve(os.homedir(), '.config/solana/id.json'),
    path.resolve(__dirname, '../../wallet.json'),
    path.resolve(__dirname, '../wallet.json'),
    path.resolve(process.cwd(), 'wallet.json'),
    path.resolve(process.cwd(), '../wallet.json')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Found wallet at: ${p}`);
      return p;
    }
  }
  
  throw new Error('wallet.json file not found. Please create one using "solana-keygen new -o wallet.json" or specify --keypair');
}

function getKeypair(filePath) {
  try {
    const secretKey = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch (error) {
    console.error(`Error loading keypair from ${filePath}:`, error);
    throw new Error(`Failed to load keypair from ${filePath}. Make sure the file exists and contains a valid JSON array of numbers.`);
  }
}

// Функция для проверки баланса кошелька
async function checkBalance() {
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Current wallet address: ${walletKeypair.publicKey.toString()}`);
  console.log(`Current balance: ${balance / 1000000000} SOL`);
  return balance;
}

// Команда для добавления аккаунта в белый список
async function addToWhitelist(newAccount) {
  try {
    console.log(`Adding account ${newAccount.toString()} to whitelist...`);
    
    // Проверяем баланс
    const balance = await checkBalance();
    if (balance < 10000) {
      console.log('Warning: Your wallet balance is very low!');
    }
    
    // Получаем PDA для белого списка - ВАЖНО: используем "whitelist", а не "white_list"
    const [whiteListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist')],
      PROGRAM_ID
    );
    
    console.log(`Found whitelist PDA at: ${whiteListPDA.toString()}`);
    
    // Используем Anchor для построения инструкции
    const tx = await program.methods
      .addToWhitelist()
      .accounts({
        newAccount: newAccount,
        whiteList: whiteListPDA, // Имя должно соответствовать Rust-структуре
        authority: walletKeypair.publicKey,
      })
      .transaction();
    
    // Отправляем транзакцию
    tx.feePayer = walletKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    
    tx.sign(walletKeypair);
    
    console.log("Sending transaction...");
    const signature = await connection.sendRawTransaction(tx.serialize());
    
    console.log("Waiting for confirmation...");
    await connection.confirmTransaction(signature);
    
    console.log(`Added to Whitelist: ${signature}`);
    return signature;
    
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    throw error;
  }
}

// Получаем и показываем справку по командам
function showHelp() {
  console.log('Usage:');
  console.log('  node src/index.js [options] <command> [args]');
  console.log('');
  console.log('Options:');
  console.log('  --keypair <path>    Path to keypair file (JSON array with secret key)');
  console.log('  --url <url>         RPC URL (default: devnet)');
  console.log('');
  console.log('Commands:');
  console.log('  add-to-whitelist <PUBLIC_KEY>  Add an account to the whitelist');
  console.log('  help                           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node src/index.js add-to-whitelist 9JpR9tq25e9DwJPrv8KaXCtUHZ9P193brHQs4ru2z5Gn');
  console.log('  node src/index.js --keypair ~/.config/solana/id.json add-to-whitelist 9JpR9tq25e9DwJPrv8KaXCtUHZ9P193brHQs4ru2z5Gn');
}

// Парсинг аргументов командной строки
function parseArgs(args) {
  const result = {
    keypairPath: null,
    url: 'devnet',
    command: null,
    args: []
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--keypair' && i + 1 < args.length) {
      result.keypairPath = args[i + 1];
      i++;
    } else if (arg === '--url' && i + 1 < args.length) {
      result.url = args[i + 1];
      i++;
    } else if (arg === 'help' || arg === '--help' || arg === '-h') {
      result.command = 'help';
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.args.push(arg);
    }
  }
  
  return result;
}

// Инициализация программы
function initAnchor(keypair, url) {
    // Создаем корректную ссылку на program ID
    const programId = new anchor.web3.PublicKey(PROGRAM_ID.toString());
    
    // Создаем фейковый кошелек для Anchor, который использует наш keypair
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: (tx) => {
        tx.partialSign(walletKeypair);
        return Promise.resolve(tx);
      },
      signAllTransactions: (txs) => {
        return Promise.resolve(txs.map(tx => {
          tx.partialSign(walletKeypair);
          return tx;
        }));
      },
      payer: walletKeypair,
    };
    
    // Создаем провайдер Anchor
    const provider = new anchor.AnchorProvider(connection, wallet, {
      preflightCommitment: 'confirmed',
    });
    
    // Создаем программу с IDL
    return new anchor.Program(IDL, programId, provider);
}

// Обработка аргументов командной строки
async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  
  // Инициализируем соединение
  if (parsedArgs.url === 'devnet' || parsedArgs.url === 'dev') {
    connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  } else if (parsedArgs.url === 'testnet' || parsedArgs.url === 'test') {
    connection = new Connection(clusterApiUrl('testnet'), 'confirmed');
  } else if (parsedArgs.url === 'mainnet' || parsedArgs.url === 'main') {
    connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
  } else {
    connection = new Connection(parsedArgs.url, 'confirmed');
  }
  
  // Инициализируем кошелек
  if (parsedArgs.keypairPath) {
    try {
      walletKeypair = getKeypair(parsedArgs.keypairPath);
      console.log(`Using wallet from: ${parsedArgs.keypairPath}`);
    } catch (error) {
      console.error(`Error loading keypair: ${error.message}`);
      process.exit(1);
    }
  } else {
    try {
      walletKeypair = getKeypair(findWalletPath());
    } catch (error) {
      console.error(`Error finding wallet: ${error.message}`);
      showHelp();
      process.exit(1);
    }
  }
  
  // Инициализируем программу Anchor
  program = initAnchor(walletKeypair, parsedArgs.url);
  
  // Обработка команд
  if (parsedArgs.command === 'help' || !parsedArgs.command) {
    showHelp();
    return;
  }
  
  if (parsedArgs.command === 'add-to-whitelist') {
    if (parsedArgs.args.length < 1) {
      console.error('Error: Please provide an account public key');
      showHelp();
      process.exit(1);
    }
    
    try {
      const accountPubkey = new PublicKey(parsedArgs.args[0]);
      await addToWhitelist(accountPubkey);
    } catch (error) {
      console.error('Failed to add account to whitelist:', error);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${parsedArgs.command}`);
    showHelp();
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
