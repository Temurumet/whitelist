const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

// Константы
const PROGRAM_ID = "6NiHr87RjVscpZLbxoqoAfLPJi8ijR1gsniq7TfkjWHx";

async function getWhitelist() {
  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    
    // Используем правильный сид "white_list"
    const [whitelistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('white_list')],
      programId
    );
    
    console.log(`PDA белого списка: ${whitelistPDA.toString()}`);
    
    // Получаем данные аккаунта
    const accountInfo = await connection.getAccountInfo(whitelistPDA);
    
    if (!accountInfo) {
      console.log('Аккаунт белого списка не найден');
      return;
    }
    
    console.log(`Размер данных аккаунта: ${accountInfo.data.length} байт`);
    
    // Ручной парсинг данных
    // Первые 8 байтов обычно это дискриминатор аккаунта в Anchor
    // Затем 32 байта - публичный ключ authority
    const authority = new PublicKey(accountInfo.data.slice(8, 40));
    console.log(`Владелец (authority): ${authority.toString()}`);
    
    // Следующие 4 байта - размер вектора (число элементов)
    const listLength = accountInfo.data.readUInt32LE(40);
    console.log(`\nСписок аккаунтов в белом списке (${listLength}):`);
    
    // Далее идут публичные ключи, каждый по 32 байта
    for (let i = 0; i < listLength; i++) {
      const start = 44 + i * 32; // 8 (discriminator) + 32 (authority) + 4 (length) + i * 32
      const end = start + 32;
      if (end <= accountInfo.data.length) {
        const pubkey = new PublicKey(accountInfo.data.slice(start, end));
        console.log(`${i + 1}. ${pubkey.toString()}`);
      }
    }
    
  } catch (error) {
    console.error('Ошибка при получении данных:', error);
  }
}

getWhitelist();