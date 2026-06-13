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
  'dashboard': dashboardHelp,
  'jurnal': jurnalUmumHelp,
  'penjualan': posHelp,
  'persediaan': inventoryHelp,
  'arus-kas': bukuKasHelp,
  'neraca-saldo': neracaSaldoHelp,
  'laba-rugi': labaRugiHelp,
  'neraca': neracaHelp,
  'perubahan-modal': perubahanModalHelp,
  'tutup-buku': tutupBukuHelp,
  'pengaturan': pengaturanHelp,
};

export function getHelpDoc(pageName: string): HelpDoc {
  return helpRegistry[pageName] || {
    title: '📘 Pusat Bantuan',
    sections: [],
  };
}
