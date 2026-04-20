import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { typography, spacing, borderRadius, type ThemeColors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useActionCooldown } from '../hooks/useActionCooldown';

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Неверный email или пароль.';
  }
  if (m.includes('email not confirmed')) {
    return 'Подтвердите email по ссылке из письма или отключите подтверждение в Supabase.';
  }
  return message;
}

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, requestPasswordReset, authConfigured } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const cooldownLogin = useActionCooldown();
  const cooldownRegister = useActionCooldown();
  const cooldownForgot = useActionCooldown();

  const onSubmitLogin = () => {
    cooldownLogin(async () => {
      setError(null);
      setMessage(null);
      const e = email.trim();
      if (!e || password.length < 6) {
        setError('Укажите email и пароль не короче 6 символов.');
        return;
      }
      setBusy(true);
      try {
        const { error: err } = await signInWithEmail(e, password);
        if (err) setError(mapAuthError(err.message));
      } finally {
        setBusy(false);
      }
    });
  };

  const onSubmitRegister = () => {
    cooldownRegister(async () => {
      setError(null);
      setMessage(null);
      const e = email.trim();
      if (!e || password.length < 6) {
        setError('Укажите email и пароль не короче 6 символов.');
        return;
      }
      setBusy(true);
      try {
        const { error: err, needsEmailConfirmation } = await signUpWithEmail(e, password);
        if (err) {
          setError(mapAuthError(err.message));
        } else if (needsEmailConfirmation) {
          setMessage(
            'Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите. В панели Supabase можно отключить подтверждение для разработки.',
          );
        } else {
          setMessage('Регистрация выполнена, вы вошли в аккаунт.');
        }
      } finally {
        setBusy(false);
      }
    });
  };

  const onForgotSubmit = () => {
    cooldownForgot(async () => {
      setError(null);
      setMessage(null);
      const e = email.trim();
      if (!e) {
        setError('Укажите email для сброса пароля.');
        return;
      }
      setBusy(true);
      try {
        const { error: err } = await requestPasswordReset(e);
        if (err) setError(mapAuthError(err.message));
        else setMessage('Если такой аккаунт есть, на почту уйдёт письмо со ссылкой для сброса пароля.');
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : Platform.OS === 'android'
              ? 'height'
              : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.brand}>NewsMap</Text>

          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentItem, mode === 'login' && styles.segmentItemActive]}
              onPress={() => {
                setMode('login');
                setError(null);
                setMessage(null);
                setShowForgot(false);
              }}
              disabled={busy}
            >
              <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Вход</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, mode === 'register' && styles.segmentItemActive]}
              onPress={() => {
                setMode('register');
                setError(null);
                setMessage(null);
                setShowForgot(false);
              }}
              disabled={busy}
            >
              <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                Регистрация
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            {mode === 'login'
              ? 'Войдите с помощью email и пароля (Supabase Auth).'
              : 'Создайте аккаунт: email и пароль.'}
          </Text>

          {!authConfigured ? (
            <Text style={styles.warn}>
              В корневом .env укажите URL и публичный anon key: либо EXPO_PUBLIC_SUPABASE_URL и
              EXPO_PUBLIC_SUPABASE_ANON_KEY, либо SUPABASE_URL + SUPABASE_ANON_KEY (Dashboard → API, не
              service_role). Затем npx expo start -c.
            </Text>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
            textContentType="username"
            autoComplete="email"
          />

          {mode === 'register' || !showForgot ? (
            <>
              <Text style={styles.label}>Пароль</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!busy}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
                autoComplete={mode === 'login' ? 'password' : 'password-new'}
              />
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          {mode === 'login' && !showForgot ? (
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => {
                setShowForgot(true);
                setError(null);
                setMessage(null);
              }}
              disabled={busy}
            >
              <Text style={styles.forgotLinkText}>Забыли пароль?</Text>
            </TouchableOpacity>
          ) : null}

          {mode === 'login' && showForgot ? (
            <View style={styles.forgotBox}>
              <Text style={styles.forgotHint}>
                На email придёт ссылка от Supabase. Добавьте redirect URL в Authentication → URL
                Configuration, если письмо не открывает приложение.
              </Text>
              <TouchableOpacity
                style={[styles.secondaryBtn, busy && styles.primaryDisabled]}
                onPress={onForgotSubmit}
                disabled={busy || !authConfigured}
              >
                {busy ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Отправить ссылку сброса</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForgot(false)} disabled={busy}>
                <Text style={styles.backLink}>Назад к входу</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primary, busy && styles.primaryDisabled]}
              onPress={mode === 'login' ? onSubmitLogin : onSubmitRegister}
              disabled={busy || !authConfigured}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.primaryText}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeHero,
    fontWeight: typography.fontWeightBold,
    marginBottom: spacing.lg,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeightSemiBold,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMD,
    marginBottom: spacing.xl,
  },
  warn: {
    color: colors.warning,
    fontSize: typography.fontSizeSM,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeSM,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.negative,
    fontSize: typography.fontSizeSM,
    marginBottom: spacing.md,
  },
  success: {
    color: colors.positive,
    fontSize: typography.fontSizeSM,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  forgotLink: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  forgotLinkText: {
    color: colors.accentLight,
    fontSize: typography.fontSizeMD,
  },
  forgotBox: {
    marginBottom: spacing.lg,
  },
  forgotHint: {
    color: colors.textMuted,
    fontSize: typography.fontSizeSM,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  secondaryBtn: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
  },
  backLink: {
    color: colors.accentLight,
    fontSize: typography.fontSizeMD,
    textAlign: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
  },
});
}
