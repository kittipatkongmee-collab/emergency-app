package th.go.police.tpad.police_incident_mobile

import android.content.Context
import android.content.res.Configuration
import io.flutter.embedding.android.FlutterActivity
import java.util.Locale

class MainActivity : FlutterActivity() {
    override fun attachBaseContext(newBase: Context) {
        val thaiLocale = Locale.forLanguageTag("th-TH")
        Locale.setDefault(thaiLocale)
        val configuration = Configuration(newBase.resources.configuration)
        configuration.setLocale(thaiLocale)
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }
}
