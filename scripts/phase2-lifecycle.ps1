param(
    [ValidateSet(
        "BillingReport",
        "StripeSubscription",
        "PendingInvoiceItems",
        "DraftInvoices",
        "AIPackActive",
        "AIPackScheduledRemoval",
        "AIPackNone",
        "ScheduledCancel",
        "Renewing",
        "ProActive",
        "FamilyActive",
        "FamilyWithAIPack",
        "FamilyDowngradeScheduled",
        "FamilyDowngradeCanceled",
        "ProAfterFamilyDowngrade",
        "ProAfterFamilyDowngradeWithAIPack",
        "PaymentAttention",
        "PastDue",
        "EntitlementFailClosed",
        "RecoveryActive",
        "AllReadOnly"
    )]
    [string]$Test = "AllReadOnly",

    [int]$WaitSeconds = 0,

    [string]$Email = "phase2-billing@example.test",
    [string]$ExpectedWorkspaceId = "",
    [string]$ExpectedCustomerId = "",
    [string]$ExpectedSubscriptionId = "",
    [int]$ExpectedSeatCount = -1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$FamilyMonthlyPriceId = "price_1SqLVSFLueI9mUztPucoRA0h"
$FamilyYearlyPriceId = "price_1UDyX3FLueI9mUztJ3CqVJ2C"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 72)
    Write-Host $Title
    Write-Host ("=" * 72)
}

function Assert-Repo {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    if (-not (Test-Path (Join-Path $repoRoot "package.json"))) {
        throw "Could not find KonnectedRoots repo root above scripts directory."
    }
    Set-Location $repoRoot
    return $repoRoot
}

function Set-EmulatorEnv {
    $env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
    $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
    $env:GCLOUD_PROJECT = "demo-konnectedroots-phase2"
    $env:PHASE2_TEST_EMAIL = $Email
}

function Get-BillingReport {
    Set-EmulatorEnv

    $raw = & npm exec --yes --package=node@20 -- node scripts/phase2-emulator-report.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "phase2-emulator-report.mjs failed with exit code $LASTEXITCODE."
    }

    $text = ($raw | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "Billing report returned no output."
    }

    try {
        return $text | ConvertFrom-Json
    }
    catch {
        throw "Billing report did not return valid JSON."
    }
}

function Ensure-StripeApiKey {
    if (-not [string]::IsNullOrWhiteSpace($env:STRIPE_API_KEY)) {
        if (-not $env:STRIPE_API_KEY.StartsWith("sk_test_")) {
            throw "STRIPE_API_KEY is present but is not a Stripe test/sandbox key."
        }
        return
    }

    $secretPath = Join-Path (Get-Location) "functions\.secret.local"
    if (-not (Test-Path $secretPath)) {
        throw "functions\.secret.local was not found."
    }

    $keyLine = Get-Content $secretPath |
        Where-Object { $_ -match '^STRIPE_SECRET_KEY=' } |
        Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($keyLine)) {
        throw "STRIPE_SECRET_KEY was not found in functions\.secret.local."
    }

    $key = $keyLine -replace '^STRIPE_SECRET_KEY=', ''
    if ([string]::IsNullOrWhiteSpace($key) -or -not $key.StartsWith("sk_test_")) {
        throw "A valid Stripe Sandbox key was not found."
    }

    $env:STRIPE_API_KEY = $key
    $key = $null
}

function Get-StripeHeaders {
    Ensure-StripeApiKey
    return @{
        Authorization = "Bearer $env:STRIPE_API_KEY"
    }
}

function Get-StripeSubscription {
    param([string]$SubscriptionId)

    if ([string]::IsNullOrWhiteSpace($SubscriptionId) -or -not $SubscriptionId.StartsWith("sub_")) {
        throw "Invalid Stripe subscription ID."
    }

    $headers = Get-StripeHeaders
    return Invoke-RestMethod `
        -Method Get `
        -Uri "https://api.stripe.com/v1/subscriptions/$SubscriptionId" `
        -Headers $headers `
        -ErrorAction Stop
}

function Get-PendingInvoiceItems {
    param([string]$CustomerId)

    if ([string]::IsNullOrWhiteSpace($CustomerId) -or -not $CustomerId.StartsWith("cus_")) {
        throw "Invalid Stripe customer ID."
    }

    $headers = Get-StripeHeaders
    return Invoke-RestMethod `
        -Method Get `
        -Uri "https://api.stripe.com/v1/invoiceitems?customer=$CustomerId&pending=true&limit=100" `
        -Headers $headers `
        -ErrorAction Stop
}

function Get-DraftInvoices {
    param([string]$CustomerId)

    if ([string]::IsNullOrWhiteSpace($CustomerId) -or -not $CustomerId.StartsWith("cus_")) {
        throw "Invalid Stripe customer ID."
    }

    $headers = Get-StripeHeaders
    return Invoke-RestMethod `
        -Method Get `
        -Uri "https://api.stripe.com/v1/invoices?customer=$CustomerId&status=draft&limit=100" `
        -Headers $headers `
        -ErrorAction Stop
}


function Get-MetadataValue {
    param(
        $Metadata,
        [string]$Name
    )

    if ($null -eq $Metadata) {
        return $null
    }

    $property = $Metadata.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Get-NowUnixMilliseconds {
    return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function Show-BillingSummary {
    param($State)

    [PSCustomObject]@{
        Plan                    = $State.plan
        Status                  = $State.status
        CanonicalPlan           = $State.authoritativeEntitlements.canonicalPlan
        CanonicalStatus         = $State.authoritativeEntitlements.canonicalStatus
        Interval                = $State.interval
        CancelAtPeriodEnd       = $State.cancelAtPeriodEnd
        ScheduledCancellationAt = $State.scheduledCancellationAt
        CurrentPeriodEnd        = $State.currentPeriodEnd
        AIPack                  = $State.aiPack
        AIPackItemExists        = $State.aiPackItemExists
        AIPackStatus            = $State.aiPackStatus
        AIPackPaidThrough       = $State.aiPackPaidThrough
        AIPackRecurringItemExists = $State.aiPackRecurringItemExists
        AIPackCurrentPaidThroughValid = $State.aiPackCurrentPaidThroughValid
        AIPackRenewalPaymentPending = $State.aiPackRenewalPaymentPending
        BillingEvents           = $State.billingEvents.count
        AIPackGrants            = $State.aiPackGrants.count
        EffectivePlan           = $State.authoritativeEntitlements.currentPlan
        EffectivePaidEntitlement = $State.authoritativeEntitlements.effectivePaidEntitlement
        EffectiveAIAllowance    = $State.authoritativeEntitlements.effectiveAIAllowance
        PaymentAttentionRequired = $State.authoritativeEntitlements.paymentAttentionRequired
        EntitlementReason       = $State.authoritativeEntitlements.entitlementReason
        AIPackEntitlementValid  = $State.authoritativeEntitlements.aiPackEntitlementValid
        AllowanceOwnership      = $State.authoritativeEntitlements.allowanceOwnership
        FamilyWorkspaceId       = $State.familyWorkspace.id
        FamilyWorkspacePreserved = $State.familyWorkspace.preserved
        FamilySeats             = $State.familyWorkspace.seatCount
        FamilySeatLimit         = $State.familyWorkspace.seatLimit
        CollaboratorsPerTree    = $State.authoritativeEntitlements.collaboratorLimitPerTree
        StorageGiB              = $State.authoritativeEntitlements.storageEntitlementGiB
        RenewalInvoice          = $(if ($null -ne $State.renewalEvidence) { $State.renewalEvidence.renewalInvoice } else { $null })
    } | Format-List
}

function Assert-AIPackActive {
    param($State)

    $errors = @()

    if ($State.plan -notin @("pro", "family")) { $errors += "plan must be pro or family" }
    if ($State.status -notin @("active", "trialing")) { $errors += "billing status must be active or trialing" }
    if ($State.aiPack -ne $true) { $errors += "aiPack must be true" }
    if ($State.aiPackItemExists -ne $true) { $errors += "aiPackItemExists must be true for a renewing AI Pack" }
    if ($State.aiPackStatus -ne "active") { $errors += "aiPackStatus must be active" }
    if ($null -eq $State.aiPackPaidThrough -or [int64]$State.aiPackPaidThrough -le (Get-NowUnixMilliseconds)) {
        $errors += "aiPackPaidThrough must be in the future"
    }

    if ($errors.Count -gt 0) {
        throw ("AI Pack active/renewing verification FAILED: " + ($errors -join "; "))
    }

    Write-Host "PASS: AI Pack is authoritatively active and renewing."
}

function Assert-AIPackScheduledRemoval {
    param($State)

    $errors = @()

    if ($State.plan -notin @("pro", "family")) { $errors += "plan must be pro or family" }
    if ($State.status -notin @("active", "trialing")) { $errors += "base billing status must remain active or trialing" }
    if ($State.aiPack -ne $true) { $errors += "aiPack must remain true while paid access is still valid" }
    if ($State.aiPackItemExists -ne $false) { $errors += "aiPackItemExists must be false after renewal is stopped" }
    if ($State.aiPackStatus -ne "active") { $errors += "aiPackStatus must remain active through paid-through" }
    if ($null -eq $State.aiPackPaidThrough -or [int64]$State.aiPackPaidThrough -le (Get-NowUnixMilliseconds)) {
        $errors += "aiPackPaidThrough must still be in the future"
    }

    if ($errors.Count -gt 0) {
        throw ("AI Pack scheduled-removal verification FAILED: " + ($errors -join "; "))
    }

    Write-Host "PASS: AI Pack renewal is stopped, while already-paid access remains active through paid-through."
}

function Assert-AIPackNone {
    param($State)

    $errors = @()

    if ($State.aiPack -ne $false) { $errors += "aiPack must be false" }
    if ($State.aiPackItemExists -ne $false) { $errors += "aiPackItemExists must be false" }
    if ($State.aiPackStatus -ne "none") { $errors += "aiPackStatus must be none" }
    if ($null -ne $State.aiPackPaidThrough) { $errors += "aiPackPaidThrough must be null" }

    if ($errors.Count -gt 0) {
        throw ("AI Pack none verification FAILED: " + ($errors -join "; "))
    }

    Write-Host "PASS: AI Pack has no current entitlement and no recurring Stripe item."
}

function Assert-ScheduledCancel {
    param($State)

    $errors = @()

    if ($State.cancelAtPeriodEnd -ne $true) { $errors += "cancelAtPeriodEnd must be true" }
    if ($null -eq $State.scheduledCancellationAt -or [int64]$State.scheduledCancellationAt -le 0) {
        $errors += "scheduledCancellationAt must be populated"
    }
    if ($State.status -notin @("active", "trialing")) {
        $errors += "subscription must remain active/trialing until expiry"
    }

    if ($errors.Count -gt 0) {
        throw ("Scheduled cancellation verification FAILED: " + ($errors -join "; "))
    }

    Write-Host "PASS: base subscription is scheduled to cancel while retaining paid access."
}

function Assert-Renewing {
    param($State)

    $errors = @()

    if ($State.cancelAtPeriodEnd -ne $false) { $errors += "cancelAtPeriodEnd must be false" }
    if ($null -ne $State.scheduledCancellationAt) { $errors += "scheduledCancellationAt must be null" }
    if ($State.status -notin @("active", "trialing")) { $errors += "subscription must be active/trialing" }
    if ($null -eq $State.currentPeriodEnd -or [int64]$State.currentPeriodEnd -le 0) {
        $errors += "currentPeriodEnd must be populated"
    }

    if ($errors.Count -gt 0) {
        throw ("Renewing subscription verification FAILED: " + ($errors -join "; "))
    }

    Write-Host "PASS: base subscription is active and renewing."
}

function Wait-And-RefreshState {
    param(
        [int]$Seconds,
        [scriptblock]$Predicate,
        [string]$Description
    )

    if ($Seconds -le 0) {
        return Get-BillingReport
    }

    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        $state = Get-BillingReport
        if (& $Predicate $state) {
            return $state
        }

        Write-Host "Waiting for $Description..."
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)

    return $state
}

function Assert-StripeAIPackItemCount {
    param(
        $Subscription,
        [int]$ExpectedCount
    )

    $aiItems = @(
        $Subscription.items.data |
        Where-Object { (Get-MetadataValue -Metadata $_.price.metadata -Name "kr_addon") -eq "ai_pack" }
    )

    if ($aiItems.Count -ne $ExpectedCount) {
        throw "Expected $ExpectedCount Stripe AI Pack item(s), found $($aiItems.Count)."
    }

    Write-Host "PASS: Stripe AI Pack item count is $ExpectedCount."
}

function Assert-ActivePlan {
    param(
        $State,
        [ValidateSet("pro", "family")]
        [string]$ExpectedPlan
    )

    $errors = @()
    if ($State.authoritativeEntitlements.currentPlan -ne $ExpectedPlan) { $errors += "effective plan must be $ExpectedPlan" }
    if ($State.status -notin @("active", "trialing")) { $errors += "billing status must be active/trialing" }
    if ([int64]$State.currentPeriodEnd -le (Get-NowUnixMilliseconds)) { $errors += "currentPeriodEnd must be in the future" }
    if ($ExpectedPlan -eq "family") {
        if ($State.familyWorkspace.exists -ne $true) { $errors += "Family workspace must exist" }
        if ($State.familyWorkspace.currentUserIsOwner -ne $true) { $errors += "current account must own the Family workspace" }
        if ($State.familyWorkspace.linkedToUser -ne $true) { $errors += "Family workspace must be linked after paid activation" }
        if ([int]$State.familyWorkspace.seatCount -lt 1 -or [int]$State.familyWorkspace.seatCount -gt 6) { $errors += "Family seat count must include the owner and stay within 6" }
        if ([int]$State.familyWorkspace.seatLimit -ne 6) { $errors += "Family seat limit must be 6" }
        if ([int]$State.authoritativeEntitlements.collaboratorLimitPerTree -ne 20) { $errors += "Family collaborator limit must remain 20 per tree" }
        if ($State.authoritativeEntitlements.allowanceOwnership -ne "family-pooled") { $errors += "Family allowance must be pooled" }
    }

    if ($errors.Count -gt 0) {
        throw ("$ExpectedPlan active-plan verification FAILED: " + ($errors -join "; "))
    }
    Write-Host "PASS: authoritative active plan is $ExpectedPlan."
}

function Assert-PaymentAttention {
    param($State)

    $attentionStatuses = @("past_due", "unpaid", "incomplete", "incomplete_expired")
    $errors = @()
    if ($State.authoritativeEntitlements.canonicalPlan -notin @("pro", "family")) {
        $errors += "canonical plan must remain pro or family"
    }
    if ($State.authoritativeEntitlements.canonicalStatus -notin $attentionStatuses) {
        $errors += "canonical status must require payment attention"
    }
    if ($State.authoritativeEntitlements.paymentAttentionRequired -ne $true) {
        $errors += "paymentAttentionRequired must be true"
    }
    if ($State.authoritativeEntitlements.effectivePaidEntitlement -ne $false) {
        $errors += "effective paid entitlement must be false"
    }
    if ($State.authoritativeEntitlements.currentPlan -ne "free") {
        $errors += "effective plan must fail closed to free"
    }
    if ([string]::IsNullOrWhiteSpace([string]$State.stripeSubscriptionId)) {
        $errors += "Stripe subscription must remain identifiable"
    }
    if ($State.familyWorkspace.id -and $State.familyWorkspace.preserved -ne $true) {
        $errors += "Family workspace must remain preserved"
    }
    if ($errors.Count -gt 0) {
        throw ("Payment-attention verification FAILED: " + ($errors -join "; "))
    }

    Write-Host "PASS: canonical billing remains identifiable while effective paid entitlement is fail-closed."
}

function Assert-EntitlementFailClosed {
    param(
        $State,
        [switch]$SkipPaymentAttention
    )

    if (-not $SkipPaymentAttention) {
        Assert-PaymentAttention -State $State
    }
    if ([int]$State.authoritativeEntitlements.effectiveAIAllowance -gt 10) {
        throw "Entitlement fail-closed verification FAILED: paid AI allowance is still exposed."
    }
    if ([int]$State.authoritativeEntitlements.effectiveAIAllowance -ne 10) {
        throw "Entitlement fail-closed verification FAILED: expected Free effective allowance of 10, found $($State.authoritativeEntitlements.effectiveAIAllowance)."
    }
    if ($State.authoritativeEntitlements.aiPackEntitlementValid -eq $true) {
        throw "Entitlement fail-closed verification FAILED: AI Pack remains effective while base billing is non-entitled."
    }
    Write-Host "PASS: effective entitlements expose only the Free allowance (10); canonical $($State.authoritativeEntitlements.canonicalPlan) data remains preserved."
}

function Assert-StripeBasePlan {
    param(
        $Subscription,
        [ValidateSet("pro", "family")]
        [string]$ExpectedPlan,
        [string]$Interval
    )

    $proItems = @($Subscription.items.data | Where-Object { (Get-MetadataValue -Metadata $_.price.metadata -Name "kr_plan") -eq "pro" })
    $familyItems = @($Subscription.items.data | Where-Object { (Get-MetadataValue -Metadata $_.price.metadata -Name "kr_plan") -eq "family" })
    if ($ExpectedPlan -eq "pro" -and ($proItems.Count -ne 1 -or $familyItems.Count -ne 0)) {
        throw "Expected exactly one Pro base item and zero Family base items."
    }
    if ($ExpectedPlan -eq "family") {
        if ($familyItems.Count -ne 1 -or $proItems.Count -ne 0) {
            throw "Expected exactly one Family base item and zero Pro base items."
        }
        $expectedPriceId = if ($Interval -eq "year") { $FamilyYearlyPriceId } else { $FamilyMonthlyPriceId }
        $expectedAmount = if ($Interval -eq "year") { 9900 } else { 999 }
        if ($familyItems[0].price.id -ne $expectedPriceId -or [int]$familyItems[0].price.unit_amount -ne $expectedAmount) {
            throw "Family base item is not the approved `$99/year or `$9.99/month Stripe price."
        }
    }
    Write-Host "PASS: Stripe has exactly one $ExpectedPlan base item and no other base-plan item."
}

$repoRoot = Assert-Repo
Set-EmulatorEnv

Write-Host "KonnectedRoots Phase 2 Lifecycle Harness"
Write-Host "Repo: $repoRoot"
Write-Host "Test: $Test"
Write-Host "Mode: READ-ONLY"
Write-Host "This script does not create, update, delete, finalize, or pay Stripe objects."

switch ($Test) {
    { $_ -in @("FamilyDowngradeScheduled", "FamilyDowngradeCanceled", "ProAfterFamilyDowngrade", "ProAfterFamilyDowngradeWithAIPack") } {
        if ($Email -notmatch '^phase2-family-downgrade([+.-][a-z0-9-]+)?@example\.test$') {
            throw "Use a NEW disposable phase2-family-downgrade account for these assertions."
        }
        if (!$ExpectedWorkspaceId -or !$ExpectedCustomerId -or !$ExpectedSubscriptionId -or $ExpectedSeatCount -lt 1) {
            throw "Supply the exact workspace/customer/subscription IDs and retained seat count from the Family baseline."
        }
        $state = Get-BillingReport
        if ($state.stripeCustomerId -ne $ExpectedCustomerId -or $state.stripeSubscriptionId -ne $ExpectedSubscriptionId -or
            $state.familyWorkspace.id -ne $ExpectedWorkspaceId -or !$state.familyWorkspace.exists -or
            !$state.familyWorkspace.currentUserIsOwner -or !$state.familyWorkspace.linkedToUser -or
            [int]$state.familyWorkspace.seatCount -ne $ExpectedSeatCount) {
            throw "Customer/subscription/workspace/seat preservation assertion failed."
        }
        $pro = $Test.StartsWith("ProAfter")
        $expectedPlan = if ($pro) { "pro" } else { "family" }
        Assert-ActivePlan -State $state -ExpectedPlan $expectedPlan
        $sub = Get-StripeSubscription -SubscriptionId $ExpectedSubscriptionId
        Assert-StripeBasePlan -Subscription $sub -ExpectedPlan $expectedPlan -Interval ([string]$state.interval)
        $expectedPackItems = if ($state.aiPackItemExists) { 1 } else { 0 }
        Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount $expectedPackItems
        $expectedAllowance = if ($pro) { 200 } else { 600 }
        if ($state.authoritativeEntitlements.aiPackEntitlementValid) { $expectedAllowance += 1000 }
        if ([int]$state.authoritativeEntitlements.effectiveAIAllowance -ne $expectedAllowance) { throw "Incorrect effective AI allowance." }
        if ($Test -eq "ProAfterFamilyDowngradeWithAIPack" -and $expectedAllowance -ne 1200) { throw "Expected valid Pro + Pack/1200." }
        if ($Test -eq "ProAfterFamilyDowngrade" -and $expectedAllowance -ne 200) { throw "Expected Pro without Pack/200." }
        if ($state.familyWorkspace.paidSeatEntitlementActive -eq $pro) { throw "Family seat entitlement was not switched correctly." }
        if ($pro -and ([int]$state.familyWorkspace.entitledSeatCount -ne 0 -or [int]$state.familyWorkspace.seatLimit -ne 0)) { throw "Retained seats must be inactive for paid entitlement." }
        if ($Test -eq "FamilyDowngradeScheduled") {
            if ($state.scheduledDowngrade.plan -ne "pro" -or $state.scheduledDowngrade.interval -ne $state.interval -or
                [int64]$state.scheduledDowngrade.effectiveAt -ne [int64]$state.currentPeriodEnd -or !$sub.schedule) { throw "Missing authoritative scheduled downgrade." }
            $schedule = Invoke-RestMethod -Method Get -Uri "https://api.stripe.com/v1/subscription_schedules/$($sub.schedule)" -Headers (Get-StripeHeaders)
            if ($schedule.metadata.kr_uid -ne $state.uid -or $schedule.metadata.kr_subscription_id -ne $ExpectedSubscriptionId -or
                $schedule.metadata.kr_change -ne "family_to_pro" -or $schedule.phases.Count -ne 2 -or $schedule.end_behavior -ne "release") { throw "Unexpected native Stripe schedule." }
            $future = $schedule.phases[1]
            if ([int64]$future.start_date * 1000 -ne [int64]$state.scheduledDowngrade.effectiveAt -or $future.proration_behavior -ne "none") { throw "Unexpected phase boundary/proration." }
            $futureBase = @($future.items | Where-Object { $_.price -ne $sub.items.data[0].price.id -and $_.price -ne $sub.items.data[-1].price.id })
            if ($futureBase.Count -ne 1) { throw "Expected exactly one future Pro base item." }
            $futurePrice = Invoke-RestMethod -Method Get -Uri "https://api.stripe.com/v1/prices/$($futureBase[0].price)" -Headers (Get-StripeHeaders)
            if ($futurePrice.metadata.kr_plan -ne "pro" -or $futurePrice.recurring.interval -ne $state.interval) { throw "Wrong Pro target/interval." }
            if ($future.items.Count -ne $sub.items.data.Count) { throw "Scheduled item count changed." }
            foreach ($addon in @($sub.items.data | Where-Object { (Get-MetadataValue -Metadata $_.price.metadata -Name "kr_addon") -eq "ai_pack" })) {
                $futurePack = @($future.items | Where-Object { $_.price -eq $addon.price.id })
                if ($futurePack.Count -ne 1 -or $futurePack[0].quantity -ne $addon.quantity) { throw "Future phase did not preserve the exact AI Pack item/quantity." }
            }
        } elseif ($null -ne $state.scheduledDowngrade.plan -or $null -ne $state.scheduledDowngrade.effectiveAt -or $sub.schedule) {
            throw "Scheduled state was not cleared/released."
        }
        Show-BillingSummary $state
        Write-Host "PASS: $Test verified from read-only Stripe and Emulator state."
    }
    "BillingReport" {
        Write-Section "Billing Report"
        $state = Get-BillingReport
        Show-BillingSummary $state
    }

    "StripeSubscription" {
        Write-Section "Stripe Subscription"
        $state = Get-BillingReport
        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)

        $sub.items.data | Select-Object `
            id,
            @{Name="price_id";Expression={$_.price.id}},
            @{Name="kr_plan";Expression={Get-MetadataValue -Metadata $_.price.metadata -Name "kr_plan"}},
            @{Name="kr_addon";Expression={Get-MetadataValue -Metadata $_.price.metadata -Name "kr_addon"}},
            @{Name="amount";Expression={$_.price.unit_amount}},
            @{Name="currency";Expression={$_.price.currency}}
    }

    "PendingInvoiceItems" {
        Write-Section "Pending Invoice Items"
        $state = Get-BillingReport
        $pending = Get-PendingInvoiceItems -CustomerId ([string]$state.stripeCustomerId)

        $pending.data | Select-Object id, amount, currency, invoice, description
        Write-Host "Pending count: $($pending.data.Count)"
    }

    "DraftInvoices" {
        Write-Section "Draft Invoices"
        $state = Get-BillingReport
        $drafts = Get-DraftInvoices -CustomerId ([string]$state.stripeCustomerId)

        $drafts.data | Select-Object id, status, amount_due, currency, auto_advance, collection_method
        Write-Host "Draft count: $($drafts.data.Count)"
    }

    "PaymentAttention" {
        Write-Section "Verify Payment Attention / Non-entitled Billing"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "payment-attention state" `
            -Predicate { param($s) $s.authoritativeEntitlements.paymentAttentionRequired -eq $true }
        Show-BillingSummary $state
        Assert-PaymentAttention $state
    }

    "PastDue" {
        Write-Section "Verify Past Due State"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "canonical past_due state" `
            -Predicate { param($s) $s.authoritativeEntitlements.canonicalStatus -eq "past_due" }
        Show-BillingSummary $state
        if ($state.authoritativeEntitlements.canonicalStatus -ne "past_due") {
            throw "Past-due verification FAILED: canonical status is '$($state.authoritativeEntitlements.canonicalStatus)'."
        }
        if ($state.authoritativeEntitlements.entitlementReason -ne "past_due") {
            throw "Past-due verification FAILED: entitlement reason is '$($state.authoritativeEntitlements.entitlementReason)'."
        }
        Assert-PaymentAttention $state
    }

    "EntitlementFailClosed" {
        Write-Section "Verify Entitlements Fail Closed"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "fail-closed entitlement state" `
            -Predicate {
                param($s)
                $s.authoritativeEntitlements.currentPlan -eq "free" -and
                $s.authoritativeEntitlements.effectivePaidEntitlement -eq $false
            }
        Show-BillingSummary $state
        Assert-EntitlementFailClosed $state
    }

    "AIPackActive" {
        Write-Section "Verify AI Pack Active and Renewing"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "AI Pack active/renewing state" `
            -Predicate { param($s) $s.aiPackStatus -eq "active" -and $s.aiPackItemExists -eq $true }

        Show-BillingSummary $state
        Assert-AIPackActive $state

        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 1
    }

    "AIPackScheduledRemoval" {
        Write-Section "Verify AI Pack Scheduled Removal"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "AI Pack scheduled-removal state" `
            -Predicate {
                param($s)
                $s.aiPackStatus -eq "active" -and
                $s.aiPack -eq $true -and
                $s.aiPackItemExists -eq $false
            }

        Show-BillingSummary $state
        Assert-AIPackScheduledRemoval $state

        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 0
    }

    "AIPackNone" {
        Write-Section "Verify AI Pack Fully Inactive"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "AI Pack inactive state" `
            -Predicate {
                param($s)
                $s.aiPackStatus -eq "none" -and
                $s.aiPackItemExists -eq $false -and
                $s.aiPack -eq $false
            }

        Show-BillingSummary $state
        Assert-AIPackNone $state

        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 0
    }

    "ScheduledCancel" {
        Write-Section "Verify Scheduled Base Cancellation"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "scheduled base cancellation state" `
            -Predicate { param($s) $s.cancelAtPeriodEnd -eq $true }

        Show-BillingSummary $state
        Assert-ScheduledCancel $state
    }

    "Renewing" {
        Write-Section "Verify Active Renewing Base Subscription"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "renewing base subscription state" `
            -Predicate { param($s) $s.cancelAtPeriodEnd -eq $false -and $null -eq $s.scheduledCancellationAt }

        Show-BillingSummary $state
        Assert-Renewing $state
    }

    "ProActive" {
        Write-Section "Verify Active Pro State"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "active Pro state" `
            -Predicate {
                param($s)
                $s.authoritativeEntitlements.currentPlan -eq "pro" -and
                $s.status -in @("active", "trialing")
            }
        Show-BillingSummary $state
        Assert-ActivePlan -State $state -ExpectedPlan "pro"
        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeBasePlan -Subscription $sub -ExpectedPlan "pro" -Interval ([string]$state.interval)
    }

    "RecoveryActive" {
        Write-Section "Verify Recovered Active Pro State"
        $state = Wait-And-RefreshState `
            -Seconds $WaitSeconds `
            -Description "recovered active Pro state" `
            -Predicate {
                param($s)
                $s.authoritativeEntitlements.canonicalPlan -eq "pro" -and
                $s.authoritativeEntitlements.canonicalStatus -eq "active" -and
                $s.authoritativeEntitlements.currentPlan -eq "pro"
            }
        Show-BillingSummary $state
        Assert-ActivePlan -State $state -ExpectedPlan "pro"
        if ($state.authoritativeEntitlements.paymentAttentionRequired -ne $false) {
            throw "Recovery verification FAILED: payment attention remains active."
        }
        if ([int]$state.authoritativeEntitlements.effectiveAIAllowance -ne 200) {
            throw "Recovery verification FAILED: expected Pro allowance of 200."
        }
        if ($state.aiPack -ne $false -or $state.aiPackItemExists -ne $false) {
            throw "Recovery verification FAILED: the no-AI-Pack scenario gained an AI Pack."
        }
        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeBasePlan -Subscription $sub -ExpectedPlan "pro" -Interval ([string]$state.interval)
        Write-Host "PASS: recovered subscription restored Pro/200 with no payment attention or AI Pack."
    }

    "FamilyActive" {
        Write-Section "Verify Active Family State"
        $state = Get-BillingReport
        Show-BillingSummary $state
        Assert-ActivePlan -State $state -ExpectedPlan "family"
        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeBasePlan -Subscription $sub -ExpectedPlan "family" -Interval ([string]$state.interval)
    }

    "FamilyWithAIPack" {
        Write-Section "Verify Family with AI Pack"
        $state = Get-BillingReport
        Show-BillingSummary $state
        Assert-ActivePlan -State $state -ExpectedPlan "family"
        Assert-AIPackActive $state
        if ([int]$state.authoritativeEntitlements.effectiveAIAllowance -ne 1600) {
            throw "Expected authoritative pooled Family + AI Pack allowance of 1600."
        }
        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        Assert-StripeBasePlan -Subscription $sub -ExpectedPlan "family" -Interval ([string]$state.interval)
        Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 1
        Write-Host "PASS: Family + AI Pack is one Family item, one AI Pack item, and a 1600-action pooled allowance."
    }

    "AllReadOnly" {
        Write-Section "Billing Report"
        $state = Get-BillingReport
        Show-BillingSummary $state

        Write-Section "Stripe Subscription"
        $sub = Get-StripeSubscription -SubscriptionId ([string]$state.stripeSubscriptionId)
        $sub.items.data | Select-Object `
            id,
            @{Name="price_id";Expression={$_.price.id}},
            @{Name="kr_plan";Expression={Get-MetadataValue -Metadata $_.price.metadata -Name "kr_plan"}},
            @{Name="kr_addon";Expression={Get-MetadataValue -Metadata $_.price.metadata -Name "kr_addon"}},
            @{Name="amount";Expression={$_.price.unit_amount}},
            @{Name="currency";Expression={$_.price.currency}}

        Write-Section "Pending Invoice Items"
        $pending = Get-PendingInvoiceItems -CustomerId ([string]$state.stripeCustomerId)
        $pending.data | Select-Object id, amount, currency, invoice, description
        Write-Host "Pending count: $($pending.data.Count)"

        Write-Section "Draft Invoices"
        $drafts = Get-DraftInvoices -CustomerId ([string]$state.stripeCustomerId)
        $drafts.data | Select-Object id, status, amount_due, currency, auto_advance, collection_method
        Write-Host "Draft count: $($drafts.data.Count)"

        Write-Section "Basic Assertions"

        if ($state.authoritativeEntitlements.currentPlan -eq "free" -and $state.authoritativeEntitlements.canonicalPlan -ne "free") {
            Assert-EntitlementFailClosed -State $state -SkipPaymentAttention
        }
        elseif ($state.authoritativeEntitlements.currentPlan -in @("pro", "family")) {
            Assert-ActivePlan -State $state -ExpectedPlan ([string]$state.authoritativeEntitlements.currentPlan)
            Assert-StripeBasePlan -Subscription $sub -ExpectedPlan ([string]$state.authoritativeEntitlements.currentPlan) -Interval ([string]$state.interval)
        }

        if (
            $state.authoritativeEntitlements.currentPlan -eq "family" -and
            $state.aiPackStatus -eq "active" -and
            $null -ne $state.aiPackPaidThrough -and
            [int64]$state.aiPackPaidThrough -gt (Get-NowUnixMilliseconds) -and
            [int]$state.authoritativeEntitlements.effectiveAIAllowance -ne 1600
        ) {
            throw "Active paid-through Family AI Pack must resolve to the shared 1600-action allowance."
        }

        if ($state.authoritativeEntitlements.currentPlan -ne "free") {
            if ($state.cancelAtPeriodEnd -eq $true) {
                Assert-ScheduledCancel $state
            }
            else {
                Assert-Renewing $state
            }

            if (
                $state.aiPack -eq $true -and
                $state.aiPackStatus -eq "active" -and
                $state.aiPackItemExists -eq $true
            ) {
                Assert-AIPackActive $state
                Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 1
            }
            elseif (
                $state.aiPack -eq $true -and
                $state.aiPackStatus -eq "active" -and
                $state.aiPackItemExists -eq $false
            ) {
                Assert-AIPackScheduledRemoval $state
                Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 0
            }
            elseif (
                $state.aiPack -eq $false -and
                $state.aiPackStatus -eq "none" -and
                $state.aiPackItemExists -eq $false
            ) {
                Assert-AIPackNone $state
                Assert-StripeAIPackItemCount -Subscription $sub -ExpectedCount 0
            }
            else {
                throw "Unrecognized AI Pack state. Review canonical billing state before proceeding."
            }
        }

        if ($pending.data.Count -ne 0) {
            Write-Host "WARNING: pending invoice items exist. Review before any billing mutation."
        }

        if ($drafts.data.Count -ne 0) {
            Write-Host "WARNING: draft invoices exist. Review before any billing mutation."
        }
    }
}

Write-Host ""
Write-Host "Completed successfully."
