using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
[assembly: AssemblyTitle("DisMulekadinhaCord")]
[assembly: AssemblyProduct("DisMulekadinhaCord")]
[assembly: AssemblyCompany("DisMulekadinhaCord")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

internal static class Program {
    internal const string SiteUrl = "https://dismulekadinhacord.rampageplz.chatgpt.site";
    [STAThread]
    private static void Main(string[] args) {
        bool created;
        using (var mutex = new Mutex(true, "Local\\DisMulekadinhaCord", out created)) {
            if (!created) return;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainWindow());
        }
    }
}

internal sealed class MainWindow : Form {
    private readonly WebView2 web = new WebView2();
    private readonly Panel status = new Panel();
    private readonly Label message = new Label();
    private readonly Button retry = new Button();
    private CoreWebView2Environment environment;
    private bool initializing;
    private bool fullScreen;
    private FormBorderStyle previousBorderStyle;
    private FormWindowState previousWindowState;
    private Rectangle previousBounds;
    private readonly Uri origin = new Uri(Program.SiteUrl);
    [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    internal MainWindow() {
        Text = "DisMulekadinhaCord";
        Width = 1320; Height = 860;
        MinimumSize = new Size(420, 500);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(30,31,34);
        Font = new Font("Segoe UI", 11);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        Controls.Add(web);
        status.Dock = DockStyle.Fill; status.BackColor = BackColor;
        message.AutoSize = false; message.Dock = DockStyle.Fill;
        message.TextAlign = ContentAlignment.MiddleCenter;
        message.ForeColor = Color.FromArgb(219,222,225);
        message.Text = "Conectando a mulekadinha…";
        retry.Dock = DockStyle.Bottom; retry.Height = 48;
        retry.Text = "Tentar novamente"; retry.Visible = false;
        retry.BackColor = Color.FromArgb(88,101,242); retry.ForeColor = Color.White;
        retry.FlatStyle = FlatStyle.Flat;
        retry.Click += async (sender,e) => { if(web.CoreWebView2!=null) { ShowStatus("Reconectando…",false); web.CoreWebView2.Navigate(Program.SiteUrl); } else await Initialize(); };
        status.Controls.Add(message); status.Controls.Add(retry);
        Controls.Add(status); status.BringToFront();
        Shown += async (sender,e) => await Initialize();
        FormClosed += (sender,e) => web.Dispose();
        KeyPreview = true;
        KeyDown += (sender,e) => {
            if(e.KeyCode==Keys.F5 && web.CoreWebView2!=null) { web.Reload(); e.Handled=true; }
            if(e.Alt && e.KeyCode==Keys.Left && web.CanGoBack) {web.GoBack();e.Handled=true;}
            if(e.KeyCode==Keys.Escape && fullScreen && web.CoreWebView2!=null) {web.CoreWebView2.ExecuteScriptAsync("document.exitFullscreen()");e.Handled=true;}
        };
    }
    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        try { int dark=1; DwmSetWindowAttribute(Handle,20,ref dark,4); } catch {}
    }
    private bool SameOrigin(string value) {
        Uri uri;
        return Uri.TryCreate(value,UriKind.Absolute,out uri) && uri.Scheme=="https" && uri.Host==origin.Host && uri.Port==origin.Port;
    }
    private void ShowStatus(string text,bool allowRetry) {
        message.Text=text; retry.Visible=allowRetry;status.Visible=true;status.BringToFront();
    }
    private void SetFullScreen(bool enabled) {
        if(enabled==fullScreen) return;
        if(enabled) {
            previousBorderStyle=FormBorderStyle;
            previousWindowState=WindowState;
            previousBounds=Bounds;
            FormBorderStyle=FormBorderStyle.None;
            WindowState=FormWindowState.Maximized;
        } else {
            WindowState=FormWindowState.Normal;
            FormBorderStyle=previousBorderStyle;
            Bounds=previousBounds;
            WindowState=previousWindowState;
        }
        fullScreen=enabled;
    }
    private async System.Threading.Tasks.Task Initialize() {
        if(initializing) return; initializing=true;
        try {
            string runtime=CoreWebView2Environment.GetAvailableBrowserVersionString();
            string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"DisMulekadinhaCord","Profile");
            environment=await CoreWebView2Environment.CreateAsync(null,profile);
            await web.EnsureCoreWebView2Async(environment);
            web.CoreWebView2.Settings.AreDevToolsEnabled=false;
            web.CoreWebView2.Settings.IsStatusBarEnabled=false;
            web.CoreWebView2.Settings.IsBuiltInErrorPageEnabled=false;
            web.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled=false;
            web.CoreWebView2.Settings.IsPasswordAutosaveEnabled=false;
            web.CoreWebView2.Settings.IsGeneralAutofillEnabled=false;
            web.CoreWebView2.Settings.AreDefaultContextMenusEnabled=true;
            web.CoreWebView2.NavigationStarting += (sender,e) => {
                if(!SameOrigin(e.Uri) && e.Uri!="about:blank") {
                    e.Cancel=true; OpenExternal(e.Uri);
                }
            };
            web.CoreWebView2.NavigationCompleted += (sender,e) => {
                if(e.IsSuccess) status.Visible=false;
                else ShowStatus("Não foi possível conectar.\nVerifique sua internet e tente novamente.",true);
            };
            web.CoreWebView2.PermissionRequested += (sender,e) => {
                if(!SameOrigin(e.Uri)) {e.State=CoreWebView2PermissionState.Deny;return;}
                if(e.PermissionKind==CoreWebView2PermissionKind.Microphone || e.PermissionKind==CoreWebView2PermissionKind.Camera || e.PermissionKind==CoreWebView2PermissionKind.Notifications) {
                    string name=e.PermissionKind==CoreWebView2PermissionKind.Microphone?"microfone":e.PermissionKind==CoreWebView2PermissionKind.Camera?"câmera":"notificações";
                    var answer=MessageBox.Show(this,"Permitir "+name+" no DisMulekadinhaCord?","Permissão",MessageBoxButtons.YesNo,MessageBoxIcon.Question);
                    e.State=answer==DialogResult.Yes?CoreWebView2PermissionState.Allow:CoreWebView2PermissionState.Deny;
                    e.SavesInProfile=true;
                }
            };
            // The runtime's own capture picker remains in control of what is shared.
            web.CoreWebView2.ScreenCaptureStarting += (sender,e) => {if(!SameOrigin(web.Source.ToString()))e.Cancel=true;};
            web.CoreWebView2.ContainsFullScreenElementChanged += (sender,e) => BeginInvoke(new Action(() => SetFullScreen(web.CoreWebView2.ContainsFullScreenElement)));
            web.CoreWebView2.NewWindowRequested += async (sender,e) => {
                if(!SameOrigin(e.Uri)) {e.Handled=true;OpenExternal(e.Uri);return;}
                var deferral=e.GetDeferral();
                try {
                    var popup=new Form {Text="DisMulekadinhaCord — Anexo",Width=900,Height=650,BackColor=BackColor,StartPosition=FormStartPosition.CenterParent};
                    var view=new WebView2 {Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};
                    popup.Controls.Add(view);
                    popup.FormClosed+=(s,a)=>view.Dispose();
                    await view.EnsureCoreWebView2Async(environment);
                    view.CoreWebView2.Settings.AreDevToolsEnabled=false;
                    view.CoreWebView2.NavigationStarting+=(s,a)=>{if(!SameOrigin(a.Uri)&&a.Uri!="about:blank"){a.Cancel=true;OpenExternal(a.Uri);}};
                    view.CoreWebView2.PermissionRequested+=(s,a)=>a.State=CoreWebView2PermissionState.Deny;
                    e.NewWindow=view.CoreWebView2;e.Handled=true;popup.Show(this);
                } finally {deferral.Complete();}
            };
            web.CoreWebView2.ProcessFailed+=(sender,e)=>ShowStatus("A janela encontrou um problema.\nClique abaixo para reconectar.",true);
            web.CoreWebView2.Navigate(Program.SiteUrl);
        } catch(WebView2RuntimeNotFoundException) {
            ShowStatus("O Microsoft Edge WebView2 é necessário.\nExecute novamente o instalador para instalar o componente.",true);
        } catch(Exception) {
            ShowStatus("Não foi possível abrir o aplicativo.\nAtualize o Microsoft Edge WebView2 e tente novamente.",true);
        } finally {initializing=false;}
    }
    private static void OpenExternal(string value) {
        Uri uri;if(!Uri.TryCreate(value,UriKind.Absolute,out uri) || uri.Scheme!="https")return;
        try {Process.Start(new ProcessStartInfo(value){UseShellExecute=true});}catch {}
    }
}
