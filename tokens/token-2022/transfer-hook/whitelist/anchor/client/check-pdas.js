const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

// Константы
const PROGRAM_ID = "6NiHr87RjVscpZLbxoqoAfLPJi8ijR1gsniq7TfkjWHx";

async function checkPDAs() {
  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    
    // Проверяем разные варианты сидов
    const variations = [
      'whitelist',
      'white_list',
      'Whitelist',
      'WhiteList',
      'white list',
      'WHITE_LIST'
    ];
    
    console.log("Проверка различных вариантов PDA для белого списка:");
    
    for (const seed of variations) {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from(seed)],
        programId
      );
      
      const accountInfo = await connection.getAccountInfo(pda);
      
      console.log(`Сид: "${seed}"`);
      console.log(`  PDA: ${pda.toString()}`);
      console.log(`  Существует: ${accountInfo !== null}`);
      if (accountInfo) {
        console.log(`  Размер: ${accountInfo.data.length} байт`);
        console.log(`  Владелец: ${accountInfo.owner.toString()}`);
      }
      console.log();
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

checkPDAs();