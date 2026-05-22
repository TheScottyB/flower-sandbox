import React from 'react';
import TestRenderer from 'react-test-renderer';
import { TextInput, TouchableOpacity, Text } from 'react-native';
import LoginScreen from '../login';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders inputs and sign in button', () => {
    const tree = TestRenderer.create(<LoginScreen />);
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs.length).toBe(2); // email and password

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signInButton = buttons.find((b) => {
      try {
        const text = b.findByType(Text);
        return text.props.children === 'Sign In';
      } catch {
        return false;
      }
    });
    expect(signInButton).toBeDefined();
  });

  it('validates empty fields and shows error', async () => {
    const tree = TestRenderer.create(<LoginScreen />);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signInButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign In';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      signInButton.props.onPress();
    });

    const errorTexts = tree.root.findAll((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorTexts.length).toBeGreaterThan(0);
    expect(errorTexts[0].props.children).toBe('Email is required');
  });

  it('validates empty password if email is provided', async () => {
    const tree = TestRenderer.create(<LoginScreen />);
    const [emailInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signInButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign In';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
    });

    await TestRenderer.act(async () => {
      signInButton.props.onPress();
    });

    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe('Password is required');
  });

  it('validates incorrect email regex if password is provided', async () => {
    const tree = TestRenderer.create(<LoginScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signInButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign In';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('invalidemail');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signInButton.props.onPress();
    });

    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe('Please enter a valid email address');
  });

  it('signs in successfully and redirects to root', async () => {
    const signInMock = supabase.auth.signInWithPassword as jest.Mock;
    signInMock.mockResolvedValueOnce({ data: { user: {} }, error: null });

    const tree = TestRenderer.create(<LoginScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signInButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign In';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signInButton.props.onPress();
    });

    expect(signInMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('renders error on failed sign in', async () => {
    const signInMock = supabase.auth.signInWithPassword as jest.Mock;
    signInMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const tree = TestRenderer.create(<LoginScreen />);
    const [emailInput, passwordInput] = tree.root.findAllByType(TextInput);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const signInButton = buttons.find((b) => {
      try {
        return b.findByType(Text).props.children === 'Sign In';
      } catch {
        return false;
      }
    })!;

    TestRenderer.act(() => {
      emailInput.props.onChangeText('test@example.com');
      passwordInput.props.onChangeText('password123');
    });

    await TestRenderer.act(async () => {
      signInButton.props.onPress();
    });

    expect(signInMock).toHaveBeenCalled();
    const errorText = tree.root.find((node) => node.props.style && node.props.style.color === '#DC2626');
    expect(errorText.props.children).toBe('Invalid login credentials');
  });
});
