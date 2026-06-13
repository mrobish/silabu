import type { HelpDoc } from './types';
import { jurnalUmumHelp } from './jurnal-umum';
import { dashboardHelp } from './dashboard';
import { posHelp } from './pos';
import { inventoryHelp } from './inventory';
import { bukuKasHelp } from './buku-kas';
import { neracaSaldoHelp } from './neraca-saldo';
import { labaRugiHelp } from './laba-rugi';
import { neracaHelp } from './neraca';
import { perubahanModalHelp } from './perubahan-modal';
import { tutupBukuHelp } from './tutup-buku';
import { pengaturanHelp } from './pengaturan';

const helpRegistry: Record<string, HelpDoc> = {
  '/': dashboardHelp,
  '/jurnal-umum': jurnalUmumHelp,
  '/pos': posHelp,
  '/persediaan': inventoryHelp,
  '/buku-kas': bukuKasHelp,
  '/neraca-saldo': neracaSaldoHelp,
  '/laba-rugi': labaRugiHelp,
  '/neraca': neracaHelp,
  '/perubahan-modal': perubahanModalHelp,
  '/tutup-buku': tutupBukuHelp,
  '/pengaturan': pengaturanHelp,
};

export function getHelpDoc(pathname: string): HelpDoc {
  return helpRegistry[pathname] || {
    title: '\u{1F4D6} Pusat Bantuan',
    sections: [
      {
        icon: '\u{1F4A1}',
        title: 'Halaman Ini',
        content: 'Panduan untuk halaman ini belum tersedia. Hubungi admin untuk informasi lebih lanjut.',
      },
    ],
  };
}
