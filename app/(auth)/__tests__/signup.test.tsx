import React from 'react';
import TestRenderer from 'react-test-renderer';
import { TextInput, TouchableOpacity, Text } from 'react-native';
import SignUpScreen from '../signup';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders inputs and sign up button', () => {
    const tree = TestRenderer.create(<SignUpScreen />);
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs.length).toBe(2);

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        const text = b.findByType(Text);
        return text.props.children === 'Sign Up';
      } catch {
        return false;
      }
    });
    expect(signUpButton).toBeDefined();
  });

  it('shows email-confirmation notice when sign up succeeds without a session', async () => {
    const signUpMock = supabase.auth.signUp as jest.Mock;
    signUpMock.mockResolvedValueOnce({ data: { user: {}, session: null }, error: null });

    const tree = TestRenderer.create(<SignUpScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign Up';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signUpButton.props.onPress();
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    const infoText = tree.root.find((node) => node.props.style && node.props.style.color === '#166534');
    expect(infoText.props.children).toBe(
      'Account created! Check your email to confirm your address, then log in.'
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('navigates home when sign up returns an active session', async () => {
    const signUpMock = supabase.auth.signUp as jest.Mock;
    signUpMock.mockResolvedValueOnce({ data: { user: {}, session: {} }, error: null });

    const tree = TestRenderer.create(<SignUpScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign Up';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signUpButton.props.onPress();
    });

    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('validates empty fields without calling the server', async () => {
    const signUpMock = supabase.auth.signUp as jest.Mock;

    const tree = TestRenderer.create(<SignUpScreen />);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign Up';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      signUpButton.props.onPress();
    });

    expect(signUpMock).not.toHaveBeenCalled();
    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe('Email is required');
  });

  it('displays user-friendly error if email is already registered', async () => {
    const signUpMock = supabase.auth.signUp as jest.Mock;
    signUpMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const tree = TestRenderer.create(<SignUpScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign Up';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signUpButton.props.onPress();
    });

    expect(signUpMock).toHaveBeenCalled();
    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe(
      'An account with this email already exists. Please try logging in instead.'
    );
  });

  it('displays standard error message for other sign up failures', async () => {
    const signUpMock = supabase.auth.signUp as jest.Mock;
    signUpMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Password should be at least 6 characters' },
    });

    const tree = TestRenderer.create(<SignUpScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign Up';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('short');
    });

    await TestRenderer.act(async () => {
      signUpButton.props.onPress();
    });

    expect(signUpMock).toHaveBeenCalled();
    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe('Password should be at least 6 characters');
  });

  it('displays generic error message on unexpected thrown errors', async () => {
    const signUpMock = supabase.auth.signUp as jest.Mock;
    signUpMock.mockRejectedValueOnce(new Error('Unexpected network failure'));

    const tree = TestRenderer.create(<SignUpScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signUpButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign Up';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signUpButton.props.onPress();
    });

    expect(signUpMock).toHaveBeenCalled();
    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe(
      'Could not reach the server. Please check your connection and try again.'
    );
  });
});

