import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronDown, Check, Search, X } from 'lucide-react-native';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownPickerProps {
  label: string;
  placeholder?: string;
  value: string;
  options: readonly (string | DropdownOption)[];
  onSelect: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  customAllow?: boolean;
  error?: string;
}

export default function DropdownPicker({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onSelect,
  required = false,
  disabled = false,
  searchable = true,
  customAllow = false,
  error,
}: DropdownPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Normalize options to { label, value }
  const normalizedOptions: DropdownOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      return opt;
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  const currentLabel = useMemo(() => {
    const found = normalizedOptions.find((opt) => opt.value === value);
    if (found) return found.label;
    return value || '';
  }, [normalizedOptions, value]);

  const handleSelect = (val: string) => {
    onSelect(val);
    setModalVisible(false);
    setSearchQuery('');
    setIsCustomMode(false);
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      onSelect(customInput.trim());
      setModalVisible(false);
      setCustomInput('');
      setIsCustomMode(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.requiredAsterisk}>*</Text>}
      </View>

      {/* Select Box Button */}
      <TouchableOpacity
        style={[
          styles.selectButton,
          disabled && styles.selectButtonDisabled,
          error ? styles.selectButtonError : null,
        ]}
        onPress={() => {
          if (!disabled) {
            setSearchQuery('');
            setModalVisible(true);
          }
        }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.selectText,
            !currentLabel && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
          numberOfLines={1}
        >
          {currentLabel || placeholder}
        </Text>
        <ChevronDown size={18} color={disabled ? '#94a3b8' : '#64748b'} />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal Picker */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <SafeAreaView style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{label}</Text>
                <Text style={styles.modalSubtitle}>Select one from the list below</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            {searchable && normalizedOptions.length > 5 && (
              <View style={styles.searchContainer}>
                <Search size={16} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={`Search ${label}...`}
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
              </View>
            )}

            {/* Options List */}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                    ]}
                    onPress={() => handleSelect(item.value)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check size={14} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matching options found</Text>
                  {customAllow && (
                    <TouchableOpacity
                      style={styles.customModeBtn}
                      onPress={() => setIsCustomMode(true)}
                    >
                      <Text style={styles.customModeBtnText}>Enter custom value</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />

            {/* Custom Mode Box (if allowed) */}
            {customAllow && (
              <View style={styles.customSection}>
                <Text style={styles.customLabel}>Or enter custom {label}:</Text>
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customInput}
                    placeholder={`Type ${label}...`}
                    placeholderTextColor="#94a3b8"
                    value={customInput}
                    onChangeText={setCustomInput}
                  />
                  <TouchableOpacity
                    style={[
                      styles.customSubmitBtn,
                      !customInput.trim() && styles.customSubmitBtnDisabled,
                    ]}
                    onPress={handleCustomSubmit}
                    disabled={!customInput.trim()}
                  >
                    <Text style={styles.customSubmitBtnText}>Use</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 3,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectButtonDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  selectButtonError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  selectText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  disabledText: {
    color: '#94a3b8',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#ffffff',
  },
  optionItemSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  optionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  optionTextSelected: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  customModeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
  },
  customModeBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  customSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  customLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  customSubmitBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  customSubmitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  customSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
