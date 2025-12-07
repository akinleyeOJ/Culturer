import { supabase } from '../supabase';

export const checkCartSystem = async (userId: string) => {
    console.log('--- START CART SYSTEM CHECK ---');
    console.log('Checking for user:', userId);

    // 1. Check Cart Access
    const { data: cartData, error: cartError } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

    if (cartError) {
        console.error('❌ Cart table access failed:', cartError);
    } else {
        console.log('✅ Cart table access successful');
    }

    // 2. Check Products Access
    const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name')
        .limit(1);

    if (productError) {
        console.error('❌ Products table access failed:', productError);
    } else {
        console.log('✅ Products table access successful');
    }

    // 3. Test Join
    const { data: joinData, error: joinError } = await supabase
        .from('cart')
        .select('*, product:products(*)')
        .eq('user_id', userId)
        .limit(1);

    if (joinError) {
        console.error('❌ Cart Join Products failed:', joinError);
    } else {
        console.log('✅ Cart Join Products successful');
        if (joinData && joinData.length > 0) {
            console.log('Sample Item:', JSON.stringify(joinData[0], null, 2));
        } else {
            console.log('ℹ️ Cart is empty, cannot verify join data content');
        }
    }
    console.log('--- END CART SYSTEM CHECK ---');
};
