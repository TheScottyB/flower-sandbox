import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { PetalBurst } from '../PetalBurst';

describe('PetalBurst', () => {
  it('renders 8 SVG Path particles, each tinted with the given color', () => {
    const onComplete = jest.fn();
    const tree = TestRenderer.create(
      <PetalBurst x={50} y={50} color="#FF0000" type="rose" onComplete={onComplete} />
    );
    const paths = tree.root.findAllByType(Path);
    expect(paths).toHaveLength(8);
    paths.forEach((p) => {
      expect(p.props.fill).toBe('#FF0000');
      expect(p.props.d).toBeTruthy();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
