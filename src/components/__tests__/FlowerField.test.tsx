import React from 'react';
import TestRenderer from 'react-test-renderer';
import { TouchableWithoutFeedback } from 'react-native';
import { FlowerField } from '../FlowerField';
import * as Haptics from 'expo-haptics';

// Mock PetalBurst to avoid running animation callbacks that delete bursts synchronously
jest.mock('../PetalBurst', () => {
  const React = require('react');
  return {
    PetalBurst: (props: any) => React.createElement('PetalBurst', props),
  };
});

const findFlowers = (root: any) => {
  return root.findAll((node: any) => {
    return node.props && node.props.type && node.props.size && node.props.position;
  });
};

describe('FlowerField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial flowers based on count prop', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(<FlowerField count={5} />);
    });
    const flowers = findFlowers(tree.root);
    expect(flowers.length).toBe(5);
  });

  it('adds a flower and a petal burst on background tap', () => {
    const onAddFlowerMock = jest.fn();
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <FlowerField count={2} onAddFlower={onAddFlowerMock} />
      );
    });

    const backgroundTouch = tree.root.findByType(TouchableWithoutFeedback);

    // Tap the background at coordinates (100, 200)
    TestRenderer.act(() => {
      backgroundTouch.props.onPress({
        nativeEvent: { locationX: 100, locationY: 200 },
      });
    });

    // Check that we now have 3 flowers
    const flowers = findFlowers(tree.root);
    expect(flowers.length).toBe(3);

    // Check that a PetalBurst is rendered at (100, 200)
    const bursts = tree.root.findAllByType('PetalBurst');
    expect(bursts.length).toBe(1);
    expect(bursts[0].props.x).toBe(100);
    expect(bursts[0].props.y).toBe(200);

    // Verify callback and haptics
    expect(onAddFlowerMock).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('enforces maxFlowers cap', () => {
    const onAddFlowerMock = jest.fn();
    let tree: any;
    // Set maxFlowers to 3, and count to 3
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <FlowerField count={3} maxFlowers={3} onAddFlower={onAddFlowerMock} />
      );
    });

    const flowersBefore = findFlowers(tree.root);
    expect(flowersBefore.length).toBe(3);

    const backgroundTouch = tree.root.findByType(TouchableWithoutFeedback);

    // Tap background to add a 4th flower
    TestRenderer.act(() => {
      backgroundTouch.props.onPress({
        nativeEvent: { locationX: 150, locationY: 250 },
      });
    });

    // Total flowers should still be 3 (oldest removed)
    const flowersAfter = findFlowers(tree.root);
    expect(flowersAfter.length).toBe(3);

    // The callback onAddFlower should NOT be called since it was at cap
    expect(onAddFlowerMock).not.toHaveBeenCalled();
  });
});
