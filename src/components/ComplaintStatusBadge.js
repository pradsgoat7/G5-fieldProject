import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { complaintStatusLabel } from '../services/complaintService';

// Status colors always come with an icon and a label, never color alone
const STATUS_STYLE = {
  Open: { color: colors.warning, icon: 'alert-circle' },
  InProgress: { color: '#1976D2', icon: 'progress-wrench' },
  Resolved: { color: colors.success, icon: 'check-circle' },
  Rejected: { color: colors.textSecondary, icon: 'close-circle' }
};

const ComplaintStatusBadge = ({ status }) => {
  const style = STATUS_STYLE[status] || STATUS_STYLE.Open;
  return (
    <View style={[styles.badge, { backgroundColor: style.color }]}>
      <MaterialCommunityIcons name={style.icon} size={13} color="#FFF" />
      <Text style={styles.text}>{complaintStatusLabel(status)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  text: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }
});

export default ComplaintStatusBadge;
