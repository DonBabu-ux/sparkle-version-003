package com.sparkleapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.sparkleapp.plugins.PrivacyProtectionPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrivacyProtectionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
