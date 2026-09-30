import type { billImport as zhBillImport } from '../zh-CN/billImport';

export const billImport: Record<keyof typeof zhBillImport, string> = {
  'billImport.title': 'Import bills',
  'billImport.page.description':
    'Import a WeChat Pay or Alipay bill to fill in the merchant and details of auto-captured records.',
  'billImport.chooseFile': 'Choose a bill file',
  'billImport.page.formats': 'CSV / XLSX · GBK or UTF-8 · duplicates skipped automatically',
  'billImport.howto.title': 'Where to export the bill',
  'billImport.howto.wechat':
    'WeChat: Me → Services → Wallet → Bills → top-right "Common questions" → Download bill → For personal reconciliation',
  'billImport.howto.alipay':
    'Alipay: Me → Bills → top-right "⋯" → Issue transaction statement → For personal reconciliation; you get a ZIP, unzip it and import the CSV inside',
  'billImport.howto.note':
    'Both allow exporting several months at once. Import whenever you like — duplicates are never counted twice.',
  'billImport.upload.prompt': 'Drop a WeChat Pay or Alipay bill here',
  'billImport.upload.hint':
    'Or click to choose a file · CSV / XLSX · GBK or UTF-8 · duplicates skipped automatically',
  'billImport.upload.parsing': 'Parsing the bill…',
  'billImport.upload.wrongType':
    'Please choose a bill file (.csv or .xlsx) exported from WeChat Pay or Alipay',
  'billImport.upload.failed': 'Import failed: {message}',
  'billImport.format.wechat': 'WeChat Pay bill',
  'billImport.format.alipay': 'Alipay bill',
  'billImport.result.added_one': 'Imported {count} new record',
  'billImport.result.added_other': 'Imported {count} new records',
  'billImport.result.duplicates_one': '{count} record already existed — skipped',
  'billImport.result.duplicates_other': '{count} records already existed — skipped',
  'billImport.result.none': 'Nothing new was imported',
  'billImport.stats.format': 'Format: {format}',
  'billImport.stats.parsed': 'Parsed: {count}',
  'billImport.stats.added': 'Added: {count}',
  'billImport.stats.enriched': 'Completed: {count}',
  'billImport.stats.duplicates': 'Duplicates: {count}',
  'billImport.stats.ignored': 'Unfinished (skipped): {count}',
  'billImport.done.summary': 'Import complete — {parts}',
  'billImport.done.separator': ', ',
  'billImport.done.added': '{count} added',
  'billImport.done.enriched': '{count} auto-captures completed',
  'billImport.done.classified': '{count} auto-categorised',
  'billImport.done.nothing': 'Nothing new to import (all duplicates)',
};
