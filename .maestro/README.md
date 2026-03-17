# Testes Maestro - ION App

## Como executar

### Pré-requisitos
1. Instalar Maestro: `curl -fsSL "https://get.maestro.mobile.dev" | bash`
2. Ter um emulador Android rodando OU dispositivo conectado via ADB
3. App instalado no device/emulador

### Executar todos os testes
```bash
export PATH="$PATH":"$HOME/.maestro/bin"
maestro test .maestro/
```

### Executar teste individual
```bash
maestro test .maestro/01_login_flow.yaml
maestro test .maestro/04_navigation_stability.yaml
```

### Rodar em modo debug (ver cada passo)
```bash
maestro test .maestro/01_login_flow.yaml --debug-output ./maestro-debug
```

## Testes disponíveis

| Arquivo | O que testa |
|---------|-------------|
| `01_login_flow.yaml` | Login com email/senha do reviewer |
| `02_register_flow.yaml` | Cadastro de novo usuário |
| `03_subscription_screen.yaml` | Tela de paywall sem crash |
| `04_navigation_stability.yaml` | Estabilidade de navegação (crítico para Google Play) |

## Credenciais de Teste (Reviewer)
- Email: `review@ionapp.ai`
- Senha: `Ion@Review2026`

## Problemas conhecidos e correções aplicadas
1. **Dupla navegação**: `_layout.tsx` e `index.tsx` navegavam simultaneamente → corrigido
2. **Cache de assinatura**: IAP falha derrubava assinatura válida → corrigido
3. **Redirect prematuro**: `subscription.tsx` redirecionava antes do loading completar → corrigido
4. **Timer de navegação**: `register.tsx` usava setTimeout frágil → substituído por estado reativo
