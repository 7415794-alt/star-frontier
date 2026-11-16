package io.github.starfrontier;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

// 별무리 개척기 — 화면 꺼짐 방지 · 뒤로가기로 앱이 꺼지지 않게
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 가만히 둬도 화면이 꺼지거나 화면보호기로 넘어가지 않음
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // 앱을 끄지 않고 게임에 알림 (팝업 닫기 → 전투 탭으로)
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript("window.onAppBack && window.onAppBack()", null);
        }
    }
}
