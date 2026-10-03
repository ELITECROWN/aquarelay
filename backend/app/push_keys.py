"""Generate free VAPID keys into an ignored file; never print the private key."""
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def main():
    target=Path(__file__).resolve().parents[2]/'.env.push'
    if target.exists():raise SystemExit('Existing .env.push preserved. Reuse its keys; rotating invalidates existing browser subscriptions.')
    private=ec.generate_private_key(ec.SECP256R1())
    private_der=private.private_bytes(serialization.Encoding.DER,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
    public=private.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)
    target.write_text('VAPID_PRIVATE_KEY='+base64.b64encode(private_der).decode()+'\nVAPID_PUBLIC_KEY='+base64.urlsafe_b64encode(public).decode().rstrip('=')+'\n',encoding='utf-8')
    print('Saved free VAPID keys to ignored .env.push. Add these values to Render environment settings; do not send them in chat.')

if __name__=='__main__':main()
