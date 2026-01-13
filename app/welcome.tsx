import { View } from 'react-native';
import { WelcomeIntro } from '../components/WelcomeIntro';

export default function WelcomeScreen() {
    return (
        <View style={{ flex: 1 }}>
            <WelcomeIntro />
        </View>
    );
}
