import * as Haptics from 'expo-haptics';
import { TouchableOpacity } from 'react-native';
import { Path } from 'react-native-svg';
import TestRenderer from 'react-test-renderer';
import { Flower } from '../Flower';

describe('Flower', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default daisy settings', () => {
    const tree = TestRenderer.create(<Flower />);
    const paths = tree.root.findAllByType(Path);
    // Daisy: 8 petals + 1 stem + 1 center = 10 paths
    expect(paths.length).toBe(10);
  });

  it('renders with custom props', () => {
    const customPosition = { x: 100, y: 150 };
    const tree = TestRenderer.create(
      <Flower
        type="rose"
        size={80}
        color="#FFD700"
        position={customPosition}
        isPremium={true}
      />,
    );

    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.style).toContainEqual({
      position: 'absolute',
      left: 100 - 80 / 2,
      top: 150 - 80 / 2,
    });

    const paths = tree.root.findAllByType(Path);
    // Rose: 3 petals + 1 stem + 1 center = 5 paths
    expect(paths.length).toBe(5);

    // Rose petals should have color '#FFD700'
    const petals = paths.slice(1, 4); // Stem is 0, center is 4
    petals.forEach((p) => {
      expect(p.props.fill).toBe('#FFD700');
      expect(p.props.opacity).toBe(1); // premium has opacity 1
    });
  });

  it('handles onPress and triggers haptics', () => {
    const onPressMock = jest.fn();
    const tree = TestRenderer.create(<Flower onPress={onPressMock} />);
    const touchable = tree.root.findByType(TouchableOpacity);

    touchable.props.onPress();

    expect(onPressMock).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });
});
