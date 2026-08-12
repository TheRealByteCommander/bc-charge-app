import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  StyleSheet 
} from 'react-native';
import { useAuth } from '../store/appStore';

const LoyaltyAdminPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    pointsPerKwh: 1.2,
    pointsPerSession: 10,
    tierThresholds: {
      bronze: { min: 0, multiplier: 1 },
      silver: { min: 1500, multiplier: 1.15 },
      gold: { min: 4000, multiplier: 1.3 },
      platinum: { min: 8000, multiplier: 1.5 },
    },
    challenges: [],
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/config/loyalty');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      Alert.alert('Fehler', 'Loyalty-Konfiguration konnte nicht geladen werden.');
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/config/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Save failed');
      Alert.alert('Erfolg', 'Loyalty-Konfiguration wurde gespeichert.');
    } catch (error) {
      Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  const updateChallenge = (index: number, field: string, value: any) => {
    const newChallenges = [...config.challenges];
    newChallenges[index] = { ...newChallenges[index], [field]: value };
    setConfig({ ...config, challenges: newChallenges });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Loyalty Admin</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allgemeine Punkte</Text>
        
        <View style={styles.inputGroup}>
          <Text>Punkte pro kWh</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={String(config.pointsPerKwh)} 
            onChangeText={(val) => setConfig({...config, pointsPerKwh: parseFloat(val) || 0})}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text>Punkte pro Ladevorgang</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={String(config.pointsPerSession)} 
            onChangeText={(val) => setConfig({...config, pointsPerSession: parseFloat(val) || 0})}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tier Schwellenwerte</Text>
        {Object.entries(config.tierThresholds).map(([tier, values]: [string, any]) => (
          <View key={tier} style={styles.inputGroup}>
            <Text style={{ textTransform: 'capitalize' }}>{tier}</Text>
            <View style={styles.row}>
              <TextInput 
                style={[styles.input, { flex: 1, marginRight: 10 }]} 
                placeholder="Min. Punkte" 
                keyboardType="numeric" 
                value={String(values.min)} 
                onChangeText={(val) => {
                  const thresholds = { ...config.tierThresholds };
                  thresholds[tier] = { ...values, min: parseFloat(val) || 0 };
                  setConfig({ ...config, tierThresholds: thresholds });
                }}
              />
              <TextInput 
                style={[styles.input, { flex: 1 }]} 
                placeholder="Multiplikator" 
                keyboardType="numeric" 
                value={String(values.multiplier)} 
                onChangeText={(val) => {
                  const thresholds = { ...config.tierThresholds };
                  thresholds[tier] = { ...values, multiplier: parseFloat(val) || 0 };
                  setConfig({ ...config, tierThresholds: thresholds });
                }}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wöchentliche Challenges</Text>
        {config.challenges.map((ch, index) => (
          <View key={ch.id} style={styles.challengeCard}>
            <Text style={styles.challengeTitle}>{ch.titleDe}</Text>
            <View style={styles.inputGroup}>
              <Text>Ziel (Target)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={String(ch.target)} 
                onChangeText={(val) => updateChallenge(index, 'target', parseFloat(val) || 0)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text>Belohnung (Punkte)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={String(ch.rewardPoints)} 
                onChangeText={(val) => updateChallenge(index, 'rewardPoints', parseFloat(val) || 0)}
              />
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[styles.saveButton, loading && styles.disabled]} onPress={saveConfig} disabled={loading}>
        <Text style={styles.saveButtonText}>{loading ? 'Speichert...' : 'Konfiguration Speichern'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  section: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#666' },
  inputGroup: { marginBottom: 15 },
  row: { flexDirection: 'row' },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 5, 
    padding: 10, 
    marginTop: 5, 
    fontSize: 16,
    color: '#333' 
  },
  challengeCard: { 
    borderBottomWidth: 1, 
    borderColor: '#eee', 
    paddingBottom: 15, 
    marginBottom: 15 
  },
  challengeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#444' },
  saveButton: { 
    backgroundColor: '#007AFF', 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 40 
  },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabled: { backgroundColor: '#ccc' },
});

export default LoyaltyAdminPage;
