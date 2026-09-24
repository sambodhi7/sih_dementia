import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { RoutineItem } from '../storage/routines';
import { theme } from '../theme';
import { buildMemberReportHtml } from '../reports/memberReport';
import { ActionButton, Notice } from './ui';

export function MemberReportExport({ patientId, patientName, locale, routine }: { patientId: string; patientName: string; locale: string; routine: RoutineItem[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const exportReport = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('Reading local practice…');
    let step: 'reading' | 'printing' | 'sharing' = 'reading';
    // Opening the tab before local reads keeps the browser's user gesture for print.
    const reportWindow = Platform.OS === 'web' ? window.open('', '_blank') : null;
    if (Platform.OS === 'web' && !reportWindow) {
      setError('The browser blocked the report tab. Allow pop-ups for Saathi and try again.');
      setBusy(false);
      return;
    }
    try {
      if (reportWindow) {
        reportWindow.document.title = 'Preparing Saathi report';
        reportWindow.document.body.textContent = 'Preparing the local practice report…';
      }
      const reportHtml = await buildMemberReportHtml({ patientId, patientName, locale, routine });
      if (reportWindow) {
        setStatus('Opening browser print window…');
        reportWindow.document.open();
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
        reportWindow.focus();
        reportWindow.requestAnimationFrame(() => reportWindow.requestAnimationFrame(() => reportWindow.print()));
      } else {
        step = 'printing';
        setStatus(Platform.OS === 'android' ? 'Opening Android print screen…' : 'Creating PDF…');
        if (Platform.OS === 'android') {
          // Android's print screen has a built-in Save as PDF destination. It avoids
          // a second file move and share intent, which can fail inside Expo Go.
          try {
            await Print.printAsync({ html: reportHtml });
          } catch {
            // Some devices cannot open the print screen. Share the generated PDF
            // directly in that case, without moving it to another cache path.
            const result = await Print.printToFileAsync({ html: reportHtml, width: 595, height: 842 });
            if (!await Sharing.isAvailableAsync()) throw new Error('No PDF destination available');
            step = 'sharing';
            setStatus('Opening save or share options…');
            await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: 'Save or share member report' });
          }
        } else {
          const result = await Print.printToFileAsync({ html: reportHtml, width: 595, height: 842 });
          if (await Sharing.isAvailableAsync()) {
            step = 'sharing';
            setStatus('Opening save or share options…');
            await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or share member report' });
          } else {
            await Print.printAsync({ uri: result.uri });
          }
        }
      }
    } catch {
      reportWindow?.close();
      setError(step === 'reading' ? 'Local practice could not be read. Please try again.' : step === 'printing' ? 'The PDF print screen could not open. Please try again.' : 'The PDF was created, but save or share could not open. Please try again.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return <View style={styles.wrap}>
    <ActionButton label="Download PDF report" onPress={() => { void exportReport(); }} variant="secondary" disabled={busy} />
    <Text style={styles.hint}>{busy ? status : Platform.OS === 'web' ? 'Choose “Save as PDF” in the browser print window.' : Platform.OS === 'android' ? 'Choose “Save as PDF” in the Android print screen.' : 'Choose where to save or share the PDF on your device.'}</Text>
    {error ? <Notice tone="support">{error}</Notice> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hint: { color: theme.colors.mutedInk, fontSize: theme.type.meta, lineHeight: 22 },
});
